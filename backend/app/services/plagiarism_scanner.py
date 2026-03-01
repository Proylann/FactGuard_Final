import copy
import html
import json
import os
import re
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from hashlib import sha256
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_TAG_RE = re.compile(r"<[^>]+>")
_STOPWORD_RE = re.compile(
    r"\b(a|an|and|are|as|at|be|by|for|from|has|he|in|is|it|its|of|on|that|the|to|was|were|will|with|this|these|those|or|if|not|but|you|your|we|they|their|our|can|could|should|would|about|into)\b",
    re.IGNORECASE,
)


@dataclass
class PlagiarismSettings:
    max_chunks: int = 15
    top_k_results_per_chunk: int = 5
    num_results: int = 10
    gl: str | None = None
    hl: str | None = None
    near_match: bool = True
    near_match_threshold: float = 0.85
    ignore_domains: list[str] | None = None
    rate_limit_per_second: float = 5.0
    max_retries: int = 2
    search_timeout_seconds: float = 10.0
    page_timeout_seconds: float = 10.0


class WebPlagiarismScanner:
    _SERPER_URL = "https://google.serper.dev/search"
    _CACHE_TTL_SECONDS = 24 * 60 * 60

    def __init__(self, settings: Any):
        self.settings = settings
        self._search_cache: dict[str, tuple[float, list[dict[str, str]]]] = {}
        self._report_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._last_request_ts = 0.0

    def run(self, input_text: str, req_settings: PlagiarismSettings) -> dict[str, Any]:
        options: dict[str, Any] = {
            "maxChunks": req_settings.max_chunks,
            "topK": req_settings.top_k_results_per_chunk,
            "num": req_settings.num_results,
            "gl": req_settings.gl,
            "hl": req_settings.hl,
            "nearMatch": req_settings.near_match,
            "nearMatchThreshold": req_settings.near_match_threshold,
            "ignoreDomains": req_settings.ignore_domains or [],
            "rateLimitPerSecond": req_settings.rate_limit_per_second,
            "maxRetries": req_settings.max_retries,
            "searchTimeoutSeconds": req_settings.search_timeout_seconds,
            "pageTimeoutSeconds": req_settings.page_timeout_seconds,
        }
        return self.checkPlagiarismWeb(input_text, options)

    def checkPlagiarismWeb(self, inputText: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
        opts = options or {}
        max_chunks = max(1, min(30, int(opts.get("maxChunks", 6))))
        top_k = max(1, min(10, int(opts.get("topK", 3))))
        num_results = max(1, min(10, int(opts.get("num", 5))))
        gl = opts.get("gl")
        hl = opts.get("hl")
        near_match = bool(opts.get("nearMatch", True))
        near_match_threshold = float(opts.get("nearMatchThreshold", 0.85))
        ignore_domains = [d.lower().strip() for d in (opts.get("ignoreDomains") or []) if d.strip()]
        rate_limit_per_second = float(opts.get("rateLimitPerSecond", 5.0))
        max_retries = max(0, min(2, int(opts.get("maxRetries", 2))))
        search_timeout_seconds = float(opts.get("searchTimeoutSeconds", 10.0))
        page_timeout_seconds = float(opts.get("pageTimeoutSeconds", 10.0))

        cache_key = self._report_cache_key(
            inputText,
            max_chunks,
            top_k,
            num_results,
            gl,
            hl,
            near_match,
            near_match_threshold,
            ignore_domains,
        )
        now = time.time()
        cached = self._report_cache.get(cache_key)
        if cached and cached[0] > now:
            report = copy.deepcopy(cached[1])
            report.setdefault("stats", {})
            report["stats"]["fromCache"] = True
            return report

        notes: list[str] = []
        chunks = self._build_chunks(inputText, max_chunks)
        if not chunks:
            empty = {
                "overallScore": 0,
                "riskLevel": "Low",
                "matchedChunks": [],
                "topSources": [],
                "stats": {
                    "chunksUsed": 0,
                    "apiCallsUsed": 0,
                    "urlsFetched": 0,
                    "verifiedMatches": 0,
                    "fromCache": False,
                },
                "notes": ["No strong chunks were produced from the input text."],
            }
            empty["overallRiskScore"] = empty["overallScore"]
            empty["chunks"] = empty["matchedChunks"]
            self._report_cache[cache_key] = (time.time() + self._CACHE_TTL_SECONDS, copy.deepcopy(empty))
            return empty

        api_calls_used = 0
        urls_fetched = 0
        verified_matches = 0
        page_cache: dict[str, dict[str, Any]] = {}
        source_aggregate: dict[str, dict[str, Any]] = {}
        chunk_scores: list[float] = []
        matched_chunks: list[dict[str, Any]] = []

        for chunk in chunks:
            query_used = f'"{chunk}"'
            search_results, calls = self._serper_search(
                query_used,
                num_results,
                gl,
                hl,
                rate_limit_per_second,
                max_retries,
                search_timeout_seconds,
                notes,
            )
            api_calls_used += calls
            candidate_results: list[dict[str, Any]] = []
            best_chunk_score = 0.0

            for result in search_results[:top_k]:
                url = result.get("url", "")
                if self._is_ignored_domain(url, ignore_domains):
                    continue

                verification, fetched_once = self._verify_result(
                    chunk,
                    result,
                    page_cache,
                    near_match,
                    near_match_threshold,
                    page_timeout_seconds,
                    notes,
                )

                if fetched_once:
                    urls_fetched += 1

                if verification is None:
                    candidate_results.append(
                        {
                            "title": result.get("title", ""),
                            "url": url,
                            "snippet": result.get("snippet", ""),
                            "foundExact": False,
                            "foundNear": False,
                            "matchScore": 0.0,
                            "evidenceExcerpt": "",
                        }
                    )
                    continue

                if verification["foundExact"] or verification["foundNear"]:
                    verified_matches += 1
                    best_chunk_score = max(best_chunk_score, verification["matchScore"])
                    src = source_aggregate.get(verification["url"])
                    if src is None:
                        source_aggregate[verification["url"]] = {
                            "title": verification["title"],
                            "url": verification["url"],
                            "hits": 1,
                            "scoreTotal": verification["matchScore"],
                            "strongestEvidenceScore": verification["matchScore"],
                        }
                    else:
                        src["hits"] += 1
                        src["scoreTotal"] += verification["matchScore"]
                        src["strongestEvidenceScore"] = max(src["strongestEvidenceScore"], verification["matchScore"])

                candidate_results.append(verification)

            chunk_scores.append(best_chunk_score)
            if any(item["foundExact"] or item["foundNear"] for item in candidate_results):
                matched_chunks.append({"chunkText": chunk, "queryUsed": query_used, "results": candidate_results})

        overall_score = int(round((sum(chunk_scores) / max(1, len(chunk_scores))) * 100))
        risk_level = self._risk_level(overall_score)

        total_score = sum(s["scoreTotal"] for s in source_aggregate.values()) or 0.0
        top_sources = sorted(
            [
                {
                    "title": src["title"],
                    "url": src["url"],
                    "aggregatedContributionPercent": round((src["scoreTotal"] / total_score) * 100, 2)
                    if total_score
                    else 0.0,
                    "hits": src["hits"],
                    "strongestEvidenceScore": round(src["strongestEvidenceScore"], 4),
                }
                for src in source_aggregate.values()
            ],
            key=lambda x: (x["aggregatedContributionPercent"], x["hits"]),
            reverse=True,
        )

        report = {
            "overallScore": max(0, min(100, overall_score)),
            "riskLevel": risk_level,
            "matchedChunks": matched_chunks,
            "topSources": top_sources,
            "stats": {
                "chunksUsed": len(chunks),
                "apiCallsUsed": api_calls_used,
                "urlsFetched": urls_fetched,
                "verifiedMatches": verified_matches,
                "fromCache": False,
            },
            "notes": notes,
        }

        report["overallRiskScore"] = report["overallScore"]
        report["chunks"] = report["matchedChunks"]
        self._report_cache[cache_key] = (time.time() + self._CACHE_TTL_SECONDS, copy.deepcopy(report))
        return report

    def _report_cache_key(
        self,
        input_text: str,
        max_chunks: int,
        top_k: int,
        num_results: int,
        gl: str | None,
        hl: str | None,
        near_match: bool,
        near_match_threshold: float,
        ignore_domains: list[str],
    ) -> str:
        payload = {
            "input": input_text,
            "max_chunks": max_chunks,
            "top_k": top_k,
            "num_results": num_results,
            "gl": gl,
            "hl": hl,
            "near_match": near_match,
            "near_match_threshold": near_match_threshold,
            "ignore_domains": sorted(ignore_domains),
        }
        return sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()

    def _build_chunks(self, text: str, max_chunks: int) -> list[str]:
        cleaned = re.sub(r"\s+", " ", text.strip())
        if not cleaned:
            return []

        candidates = _SENTENCE_SPLIT_RE.split(cleaned)
        if len(candidates) == 1:
            candidates = re.split(r"\n+", cleaned)

        scored: list[tuple[float, str]] = []
        seen: set[str] = set()
        for raw in candidates:
            sentence = raw.strip(" \t\n\r\"'")
            if len(sentence) < 35:
                continue
            norm = self._normalize(sentence)
            if not norm or norm in seen:
                continue
            seen.add(norm)
            words = norm.split()
            if len(words) < 8:
                continue
            length_score = min(len(words), 40) / 40
            rare_score = len([w for w in words if len(w) >= 6]) / max(1, len(words))
            punctuation_score = 0.08 if any(ch in sentence for ch in ",;:-") else 0.0
            score = length_score * 0.55 + rare_score * 0.37 + punctuation_score
            scored.append((score, sentence))

        scored.sort(key=lambda item: item[0], reverse=True)
        selected = [chunk for _, chunk in scored[:max_chunks]]

        if not selected:
            words = cleaned.split()
            if len(words) < 8:
                return []
            fallback = " ".join(words[: min(30, len(words))])
            return [fallback]

        return selected

    def _serper_search(
        self,
        query: str,
        num_results: int,
        gl: str | None,
        hl: str | None,
        rate_limit_per_second: float,
        max_retries: int,
        timeout_seconds: float,
        notes: list[str],
    ) -> tuple[list[dict[str, str]], int]:
        cache_key = sha256(f"{query}|{num_results}|{gl}|{hl}".encode("utf-8")).hexdigest()
        now = time.time()
        cached = self._search_cache.get(cache_key)
        if cached and cached[0] > now:
            return copy.deepcopy(cached[1]), 0

        api_key = (getattr(self.settings, "SERPER_API_KEY", "") or "").strip()
        if not api_key:
            notes.append("SERPER_API_KEY is not configured; web search skipped.")
            return [], 0

        body = {"q": query, "num": num_results}
        if gl:
            body["gl"] = gl
        if hl:
            body["hl"] = hl

        min_interval = 1.0 / max(0.1, rate_limit_per_second)
        elapsed = time.time() - self._last_request_ts
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)

        request = Request(
            self._SERPER_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
                "User-Agent": "FactGuard/1.0",
            },
            method="POST",
        )

        last_error = ""
        calls = 0
        for attempt in range(max_retries + 1):
            try:
                with urlopen(request, timeout=max(2.0, timeout_seconds)) as response:
                    self._last_request_ts = time.time()
                    calls += 1
                    raw = response.read().decode("utf-8", errors="ignore")
                    payload = json.loads(raw)
                    organic = payload.get("organic") or []
                    results = [
                        {
                            "title": str(item.get("title") or ""),
                            "url": str(item.get("link") or item.get("url") or ""),
                            "snippet": str(item.get("snippet") or ""),
                        }
                        for item in organic
                        if (item.get("link") or item.get("url"))
                    ]
                    self._search_cache[cache_key] = (time.time() + self._CACHE_TTL_SECONDS, copy.deepcopy(results))
                    return results, calls
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as err:
                last_error = f"{err.__class__.__name__}: {err}"
                if attempt < max_retries:
                    time.sleep(0.4 * (attempt + 1))
                    continue
                break

        notes.append(f"Search failed for query: {query}. {last_error}".strip())
        return [], calls

    def _is_ignored_domain(self, url: str, ignore_domains: list[str]) -> bool:
        if not ignore_domains:
            return False
        try:
            host = (urlparse(url).netloc or "").lower()
        except Exception:
            return False
        if not host:
            return False
        return any(host == d or host.endswith(f".{d}") for d in ignore_domains)

    def _fetch_page_text(
        self,
        url: str,
        page_cache: dict[str, dict[str, Any]],
        timeout_seconds: float,
        notes: list[str],
    ) -> tuple[str, bool]:
        cached = page_cache.get(url)
        if cached is not None:
            return str(cached.get("text") or ""), False

        fetched_once = True
        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            method="GET",
        )
        try:
            with urlopen(request, timeout=max(2.0, timeout_seconds)) as response:
                html_doc = response.read().decode("utf-8", errors="ignore")
                text = self._extract_text(html_doc)
                page_cache[url] = {"text": text}
                return text, fetched_once
        except Exception as err:
            page_cache[url] = {"text": ""}
            notes.append(f"Failed to fetch URL {url}: {err.__class__.__name__}")
            return "", fetched_once

    def _verify_result(
        self,
        chunk: str,
        result: dict[str, Any],
        page_cache: dict[str, dict[str, Any]],
        near_match: bool,
        near_match_threshold: float,
        page_timeout_seconds: float,
        notes: list[str],
    ) -> tuple[dict[str, Any] | None, bool]:
        title = str(result.get("title") or "")
        url = str(result.get("url") or "")
        snippet = str(result.get("snippet") or "")
        if not url:
            return None, False

        chunk_norm = self._normalize(chunk)
        title_norm = self._normalize(title)
        snippet_norm = self._normalize(snippet)

        page_text, fetched_once = self._fetch_page_text(url, page_cache, page_timeout_seconds, notes)
        page_norm = self._normalize(page_text)

        found_exact = False
        evidence_excerpt = ""

        if chunk_norm and (chunk_norm in snippet_norm or chunk_norm in title_norm):
            found_exact = True
            evidence_excerpt = snippet[:260] or title[:260]

        if not found_exact and chunk_norm and page_norm and chunk_norm in page_norm:
            found_exact = True
            pos = page_norm.find(chunk_norm)
            if pos >= 0:
                evidence_excerpt = page_norm[max(0, pos - 60) : pos + min(len(chunk_norm) + 80, 260)]

        if found_exact:
            return (
                {
                    "title": title,
                    "url": url,
                    "snippet": snippet,
                    "foundExact": True,
                    "foundNear": False,
                    "matchScore": 1.0,
                    "evidenceExcerpt": evidence_excerpt,
                },
                fetched_once,
            )

        if not near_match:
            return (
                {
                    "title": title,
                    "url": url,
                    "snippet": snippet,
                    "foundExact": False,
                    "foundNear": False,
                    "matchScore": 0.0,
                    "evidenceExcerpt": "",
                },
                fetched_once,
            )

        best_score = 0.0
        best_excerpt = ""

        if snippet_norm:
            snippet_score = SequenceMatcher(None, chunk_norm, snippet_norm).ratio()
            if snippet_score > best_score:
                best_score = snippet_score
                best_excerpt = snippet[:260]

        if title_norm:
            title_score = SequenceMatcher(None, chunk_norm, title_norm).ratio()
            if title_score > best_score:
                best_score = title_score
                best_excerpt = title[:260]

        if page_norm:
            page_score, page_excerpt = self._best_window_similarity(chunk_norm, page_norm)
            if page_score > best_score:
                best_score = page_score
                best_excerpt = page_excerpt

        found_near = best_score >= near_match_threshold
        return (
            {
                "title": title,
                "url": url,
                "snippet": snippet,
                "foundExact": False,
                "foundNear": found_near,
                "matchScore": round(best_score, 4) if found_near else 0.0,
                "evidenceExcerpt": best_excerpt if found_near else "",
            },
            fetched_once,
        )

    def _best_window_similarity(self, chunk_norm: str, page_norm: str) -> tuple[float, str]:
        if not chunk_norm or not page_norm:
            return 0.0, ""

        if len(page_norm) > 32000:
            page_norm = page_norm[:32000]

        window = int(max(80, min(len(page_norm), len(chunk_norm) * 1.35)))
        step = max(20, window // 5)

        best_score = 0.0
        best_excerpt = ""

        for idx in range(0, max(1, len(page_norm) - window + 1), step):
            candidate = page_norm[idx : idx + window]
            if not candidate:
                continue
            score = SequenceMatcher(None, chunk_norm, candidate).ratio()
            if score > best_score:
                best_score = score
                best_excerpt = candidate[:260]
            if best_score >= 0.99:
                break

        tail_candidate = page_norm[max(0, len(page_norm) - window) :]
        if tail_candidate:
            tail_score = SequenceMatcher(None, chunk_norm, tail_candidate).ratio()
            if tail_score > best_score:
                best_score = tail_score
                best_excerpt = tail_candidate[:260]

        return best_score, best_excerpt

    def _extract_text(self, html_doc: str) -> str:
        without_scripts = re.sub(
            r"<script[\\s\\S]*?</script>|<style[\\s\\S]*?</style>",
            " ",
            html_doc,
            flags=re.IGNORECASE,
        )
        text = _TAG_RE.sub(" ", without_scripts)
        text = html.unescape(text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _normalize(self, text: str) -> str:
        normalized = text.lower()
        normalized = re.sub(r"https?://\S+", " ", normalized)
        normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
        normalized = _STOPWORD_RE.sub(" ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized

    def _risk_level(self, overall_score: int) -> str:
        if overall_score >= 75:
            return "High"
        if overall_score >= 40:
            return "Medium"
        return "Low"


def checkPlagiarismWeb(inputText: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
    class _Settings:
        SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")

    scanner = WebPlagiarismScanner(_Settings())
    return scanner.checkPlagiarismWeb(inputText, options)
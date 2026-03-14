from fastapi import APIRouter

from .account import router as account_router
from .admin import router as admin_router
from .auth import router as auth_router
from .scan import router as scan_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(account_router)
router.include_router(scan_router)
router.include_router(admin_router)

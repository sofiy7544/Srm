"""Admin authentication helpers.

Uses passlib (bcrypt) for password hashing. The admin panel is protected by a
signed session cookie (Starlette SessionMiddleware). Tokens/secrets are never
stored in code — only in the environment.

CLI usage:
    python -m app.core.security hash "my-password"
"""
import sys

from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except ValueError:
        return False


def authenticate(username: str, password: str) -> bool:
    """Validate admin credentials against env config.

    Prefers ADMIN_PASSWORD_HASH; falls back to plain ADMIN_PASSWORD for dev.
    """
    if username != settings.admin_username:
        return False
    if settings.admin_password_hash:
        return verify_password(password, settings.admin_password_hash)
    return password == settings.admin_password


def _cli() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == "hash":
        print(hash_password(sys.argv[2]))
    else:
        print('Usage: python -m app.core.security hash "your-password"')


if __name__ == "__main__":
    _cli()

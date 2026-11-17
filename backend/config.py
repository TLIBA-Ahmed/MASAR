from dataclasses import dataclass, field
from pathlib import Path
import os
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent


def load_environment():
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())


load_environment()


@dataclass(frozen=True)
class Settings:
    db_name: str = field(default_factory=lambda: os.getenv('POSTGRES_DB', 'masar'))
    identity_mode: str = field(default_factory=lambda: os.getenv('IDENTITY_MODE', 'demo'))
    ai_mode: str = field(default_factory=lambda: os.getenv('AI_MODE', 'demo'))
    professional_network: bool = field(default_factory=lambda: os.getenv('ENABLE_PROFESSIONAL_NETWORK', 'true').lower() == 'true')
    cookie_secure: bool = field(default_factory=lambda: os.getenv('COOKIE_SECURE', 'false') == 'true')
    origins: tuple[str, ...] = field(default_factory=lambda: tuple(os.getenv('ALLOWED_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174').split(',')))
    secret: str = field(default_factory=lambda: os.getenv('SESSION_SECRET', ''), repr=False)
    gateway_token: str = field(default_factory=lambda: os.getenv('MODEL_GATEWAY_TOKEN', ''), repr=False)
    gateway_url: str = field(default_factory=lambda: os.getenv('MODEL_GATEWAY_URL', 'http://127.0.0.1:8001'))
    private_path: Path = field(default_factory=lambda: Path(os.getenv('MASAR_PRIVATE_PATH',str(ROOT / '.local-data' / 'private'))))
    models_path: Path = ROOT / 'infrastructure' / 'model_artifacts'
    max_candidates: int = 8
    max_passages: int = 4
    max_context_chars: int = 6000

    def db_url(self, principal='app'):
        user = {'app': 'masar_app', 'worker': 'masar_indexer', 'admin': os.getenv('POSTGRES_USER', 'masar_migrator')}[principal]
        variable = {'app': 'POSTGRES_APP_PASSWORD', 'worker': 'POSTGRES_WORKER_PASSWORD', 'admin': 'POSTGRES_PASSWORD'}[principal]
        password = os.getenv(variable)
        if not password or password == 'GENERATE_WITH_SETUP_SCRIPT':
            raise RuntimeError('MASAR_CONFIG_MISSING: run scripts/setup-local.ps1')
        return f"postgresql+psycopg://{user}:{quote(password, safe='')}@{os.getenv('POSTGRES_HOST', '127.0.0.1')}:{os.getenv('POSTGRES_PORT', '55432')}/{self.db_name}"


settings = Settings()

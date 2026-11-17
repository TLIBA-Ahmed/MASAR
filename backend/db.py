from contextlib import contextmanager
from functools import lru_cache
from sqlalchemy import create_engine, text
from .config import settings


@lru_cache(maxsize=3)
def engine(principal='app'):
    return create_engine(settings.db_url(principal), pool_size=4, max_overflow=2, pool_pre_ping=True, hide_parameters=True, connect_args={'connect_timeout':5})


@contextmanager
def transaction(employee_id=None, purpose='identity', principal='app'):
    """SET LOCAL context expires on commit/rollback, including pooled connections."""
    with engine(principal).begin() as connection:
        connection.execute(text("SELECT set_config('masar.employee_id', :employee, true), set_config('masar.purpose', :purpose, true)"), {'employee': employee_id or '', 'purpose': purpose})
        yield connection


def rows(connection, sql, **parameters):
    return list(connection.execute(text(sql), parameters).mappings())


def one(connection, sql, **parameters):
    return connection.execute(text(sql), parameters).mappings().first()

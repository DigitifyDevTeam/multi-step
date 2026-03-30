"""
Small runtime compatibility patches for the current environment.

NOTE:
- This project uses Django 4.2.x.
- The local environment is running on Python 3.14, where Django 4.2's
  template Context copying can crash during admin template rendering.
"""

from __future__ import annotations


def patch_django_template_context_copy() -> None:
    """
    Patch Django's template context copying to avoid calling super().__copy__(),
    which can misbehave under Python 3.14 with Django 4.2.x.
    """

    try:
        from django.template.context import BaseContext  # type: ignore
    except Exception:
        return

    # If already patched, bail.
    if getattr(BaseContext.__copy__, "__name__", "") == "_basecontext_copy":
        return

    def _basecontext_copy(self: BaseContext):  # type: ignore[name-defined]
        cls = self.__class__
        duplicate = cls.__new__(cls)
        # Preserve per-context attributes (e.g. RequestContext.template).
        if hasattr(self, "__dict__") and hasattr(duplicate, "__dict__"):
            duplicate.__dict__.update(self.__dict__)
        # BaseContext stores state in a list of dicts; copy the list itself.
        duplicate.dicts = self.dicts[:]  # type: ignore[attr-defined]
        return duplicate

    BaseContext.__copy__ = _basecontext_copy  # type: ignore[assignment]


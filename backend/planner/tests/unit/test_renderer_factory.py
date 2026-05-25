"""Unit tests for the renderer factory.

The factory routes domain ids to specific renderers, falling back to
DefaultRenderer for unknown domains (the LLM-renderer pipeline consumes
the default output for custom domains).
"""

import pytest

from state_renderer import (
    RendererFactory,
    BaseStateRenderer,
    DefaultRenderer,
    BlocksWorldRenderer,
    GripperRenderer,
)
from state_renderer.depot_renderer import DepotRenderer
from state_renderer.satellite_renderer import SatelliteRenderer


pytestmark = pytest.mark.unit


def test_blocks_world_routes_to_blocks_world_renderer():
    r = RendererFactory.get_renderer("blocks-world")
    assert isinstance(r, BlocksWorldRenderer)


def test_gripper_routes_to_gripper_renderer():
    r = RendererFactory.get_renderer("gripper")
    assert isinstance(r, GripperRenderer)


def test_depot_routes_to_depot_renderer():
    r = RendererFactory.get_renderer("depot")
    assert isinstance(r, DepotRenderer)


def test_satellite_routes_to_satellite_renderer():
    r = RendererFactory.get_renderer("satellite")
    assert isinstance(r, SatelliteRenderer)


def test_unknown_domain_falls_back_to_default_renderer():
    """Hanoi/Rovers + custom LLM domains use DefaultRenderer (raw predicates)."""
    r = RendererFactory.get_renderer("totally-unknown-domain")
    assert isinstance(r, DefaultRenderer)


def test_hanoi_uses_default_renderer():
    """Hanoi is intentionally rendered by the frontend's hand-written code,
    so the backend factory falls back to DefaultRenderer."""
    r = RendererFactory.get_renderer("hanoi")
    assert isinstance(r, DefaultRenderer)


def test_register_renderer_requires_base_subclass():
    class NotARenderer:
        pass

    with pytest.raises(ValueError, match="BaseStateRenderer"):
        RendererFactory.register_renderer("bogus", NotARenderer)


def test_list_supported_domains_includes_builtins():
    supported = set(RendererFactory.list_supported_domains())
    assert {"blocks-world", "gripper", "depot", "satellite"} <= supported


def test_register_renderer_round_trip():
    class CustomRenderer(BaseStateRenderer):
        def __init__(self):
            super().__init__("custom-domain")

        def render(self, state, objects=None, predicate_schema=None):
            return {"domain": "custom-domain", "objects": [], "relations": []}

    RendererFactory.register_renderer("custom-domain", CustomRenderer)
    try:
        r = RendererFactory.get_renderer("custom-domain")
        assert isinstance(r, CustomRenderer)
    finally:
        # Clean up so we don't pollute other tests
        del RendererFactory._renderers["custom-domain"]

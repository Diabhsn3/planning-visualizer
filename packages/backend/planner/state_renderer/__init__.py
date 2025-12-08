"""
State Renderer module for converting states to RenderedState (JSON) format.

Provides domain-specific renderers for visualizing planning states.
"""

from .base_renderer import (
    BaseStateRenderer,
    DefaultRenderer,
    RenderedState,
    VisualObject,
    VisualRelation
)
from .blocks_world_renderer import BlocksWorldRenderer
from .gripper_renderer import GripperRenderer


class RendererFactory:
    """
    Factory for creating domain-specific renderers.
    """
    
    # Registry of domain renderers
    _renderers = {
        'blocks-world': BlocksWorldRenderer,
        'gripper': GripperRenderer,
    }
    
    @classmethod
    def get_renderer(cls, domain_name: str) -> BaseStateRenderer:
        """
        Get a renderer for the specified domain.
        
        Args:
            domain_name: Name of the domain
            
        Returns:
            Domain-specific renderer or DefaultRenderer if not found
        """
        renderer_class = cls._renderers.get(domain_name)
        
        if renderer_class:
            return renderer_class()
        else:
            # Return default renderer for unknown domains
            return DefaultRenderer(domain_name)
    
    @classmethod
    def register_renderer(cls, domain_name: str, renderer_class: type):
        """
        Register a custom renderer for a domain.
        
        Args:
            domain_name: Name of the domain
            renderer_class: Renderer class (must extend BaseStateRenderer)
        """
        if not issubclass(renderer_class, BaseStateRenderer):
            raise ValueError("Renderer class must extend BaseStateRenderer")
        
        cls._renderers[domain_name] = renderer_class
    
    @classmethod
    def list_supported_domains(cls) -> list:
        """
        Get list of domains with specific renderers.
        
        Returns:
            List of domain names
        """
        return list(cls._renderers.keys())


__all__ = [
    'BaseStateRenderer',
    'DefaultRenderer',
    'BlocksWorldRenderer',
    'GripperRenderer',
    'RendererFactory',
    'RenderedState',
    'VisualObject',
    'VisualRelation'
]

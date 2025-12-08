"""
Base State Renderer - converts State to RenderedState (JSON) format.

RenderedState is a JSON structure that describes how to visually represent a state.
It includes objects, their positions, properties, and relationships.
"""

from typing import Dict, List, Set, Any, Optional
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod
import json


@dataclass
class VisualObject:
    """
    Represents a visual object in the rendered state.
    
    Attributes:
        id: Unique identifier for the object
        type: Type of the object (e.g., "block", "ball", "robot")
        label: Human-readable label
        position: Optional position (x, y) or (x, y, z) coordinates
        properties: Additional visual properties (color, size, etc.)
    """
    id: str
    type: str
    label: str
    position: Optional[List[float]] = None
    properties: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "id": self.id,
            "type": self.type,
            "label": self.label
        }
        if self.position is not None:
            result["position"] = self.position
        if self.properties:
            result["properties"] = self.properties
        return result


@dataclass
class VisualRelation:
    """
    Represents a visual relationship between objects.
    
    Attributes:
        type: Type of relationship (e.g., "on", "in", "connected")
        source: Source object ID
        target: Target object ID (optional for unary relations)
        properties: Additional properties (color, style, etc.)
    """
    type: str
    source: str
    target: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "type": self.type,
            "source": self.source
        }
        if self.target is not None:
            result["target"] = self.target
        if self.properties:
            result["properties"] = self.properties
        return result


@dataclass
class RenderedState:
    """
    Complete rendered state representation.
    
    Attributes:
        domain: Domain name
        objects: List of visual objects
        relations: List of visual relationships
        metadata: Additional metadata (step number, action applied, etc.)
    """
    domain: str
    objects: List[VisualObject]
    relations: List[VisualRelation]
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "domain": self.domain,
            "objects": [obj.to_dict() for obj in self.objects],
            "relations": [rel.to_dict() for rel in self.relations]
        }
        if self.metadata:
            result["metadata"] = self.metadata
        return result
    
    def to_json(self, indent: int = 2) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)


class BaseStateRenderer(ABC):
    """
    Abstract base class for domain-specific state renderers.
    
    Each domain should implement its own renderer by extending this class.
    """
    
    def __init__(self, domain_name: str):
        """
        Initialize the renderer.
        
        Args:
            domain_name: Name of the domain
        """
        self.domain_name = domain_name
    
    @abstractmethod
    def render(self, state: Set, objects: Dict[str, str], metadata: Optional[Dict] = None) -> RenderedState:
        """
        Render a state to RenderedState format.
        
        Args:
            state: Set of predicates representing the state
            objects: Dictionary mapping object names to types
            metadata: Optional metadata (step number, action, etc.)
            
        Returns:
            RenderedState object
        """
        pass
    
    def render_sequence(self, states: List[Set], objects: Dict[str, str], 
                       actions: Optional[List[str]] = None) -> List[RenderedState]:
        """
        Render a sequence of states.
        
        Args:
            states: List of states (sets of predicates)
            objects: Dictionary mapping object names to types
            actions: Optional list of actions applied between states
            
        Returns:
            List of RenderedState objects
        """
        rendered_states = []
        
        for i, state in enumerate(states):
            metadata = {"step": i}
            
            if actions and i > 0:
                metadata["action"] = actions[i - 1]
            
            rendered = self.render(state, objects, metadata)
            rendered_states.append(rendered)
        
        return rendered_states
    
    def render_sequence_to_json(self, states: List[Set], objects: Dict[str, str],
                               actions: Optional[List[str]] = None, indent: int = 2) -> str:
        """
        Render a sequence of states to JSON string.
        
        Args:
            states: List of states (sets of predicates)
            objects: Dictionary mapping object names to types
            actions: Optional list of actions applied between states
            indent: JSON indentation level
            
        Returns:
            JSON string representation
        """
        rendered_states = self.render_sequence(states, objects, actions)
        result = {
            "domain": self.domain_name,
            "num_states": len(rendered_states),
            "states": [rs.to_dict() for rs in rendered_states]
        }
        return json.dumps(result, indent=indent)


class DefaultRenderer(BaseStateRenderer):
    """
    Default renderer for domains without specific rendering logic.
    
    Simply lists all objects and predicates without spatial layout.
    """
    
    def __init__(self, domain_name: str):
        super().__init__(domain_name)
    
    def render(self, state: Set, objects: Dict[str, str], metadata: Optional[Dict] = None) -> RenderedState:
        """
        Render state using default logic.
        
        Creates a simple list of objects and their predicates.
        """
        visual_objects = []
        visual_relations = []
        
        # Create visual objects for all domain objects
        for obj_name, obj_type in objects.items():
            if obj_type not in ['object', 'gripper', 'ball', 'room']:  # Filter out type names
                visual_obj = VisualObject(
                    id=obj_name,
                    type=obj_type,
                    label=obj_name,
                    properties={"status": "unknown"}
                )
                visual_objects.append(visual_obj)
        
        # Process predicates to extract relations
        for pred in state:
            if len(pred.params) == 0:
                # Nullary predicate (e.g., handempty)
                relation = VisualRelation(
                    type=pred.name,
                    source="global",
                    properties={"value": True}
                )
                visual_relations.append(relation)
            elif len(pred.params) == 1:
                # Unary predicate (e.g., clear, holding)
                relation = VisualRelation(
                    type=pred.name,
                    source=pred.params[0]
                )
                visual_relations.append(relation)
            elif len(pred.params) == 2:
                # Binary predicate (e.g., on, at)
                relation = VisualRelation(
                    type=pred.name,
                    source=pred.params[0],
                    target=pred.params[1]
                )
                visual_relations.append(relation)
            else:
                # N-ary predicate
                relation = VisualRelation(
                    type=pred.name,
                    source=pred.params[0],
                    target=pred.params[1] if len(pred.params) > 1 else None,
                    properties={"params": pred.params}
                )
                visual_relations.append(relation)
        
        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )

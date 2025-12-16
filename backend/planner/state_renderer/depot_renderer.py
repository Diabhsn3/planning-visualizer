from typing import Dict, List, Any, Set, Optional
from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class DepotRenderer(BaseStateRenderer):
    """
    Renderer for the Depot planning domain.
    Converts planning states into visual objects and relations.
    """

    def __init__(self):
        super().__init__("depot")
        self.colors = {
            "truck": "#00BFFF",       # Blue
            "package": "#FFD700",     # Yellow
            "depot": "#A9A9A9",       # Gray
            "distributor": "#32CD32", # Green
        }

    def render(self, state: Set, objects: Dict[str, str], metadata: Optional[Dict] = None) -> RenderedState:
        """
        Render a depot state as a visual representation.

        Args:
            state: Set of predicates representing the state
            objects: Dictionary mapping object names to types
            metadata: Optional metadata (step number, action)

        Returns:
            RenderedState object with visual elements
        """
        visual_objects = []
        visual_relations = []

        # Step 1: Create basic positions by type and index
        type_positions = {
            "depot": [0, 0],
            "distributor": [6, 0],
            "truck": [3, -2],
            "package": [3, 2],
        }
        instance_counters = {}  # Keep track of how many of each type were placed

        def get_position(obj_type: str) -> List[float]:
            base = type_positions.get(obj_type, [0, 0])
            count = instance_counters.get(obj_type, 0)
            instance_counters[obj_type] = count + 1
            # Offset each object slightly
            return [base[0] + count * 1.5, base[1]]

        # Step 2: Create visual objects
        for obj_name, obj_type in objects.items():
            if obj_name in ["package", "truck", "depot", "distributor"]:
                continue  # skip type names that got mistakenly parsed as objects

            color = self.colors.get(obj_type, "#888888")
            pos = get_position(obj_type)

            visual_objects.append(VisualObject(
                id=obj_name,
                type=obj_type,
                label=obj_name.upper(),
                position=pos,
                properties={"color": color}
            ))

        # Step 3: Create relations from predicates
        for pred in state:
            name = pred.name
            params = pred.params

            if name == "at":
                pkg, loc = params
                visual_relations.append(VisualRelation(
                    type="at",
                    source=pkg,
                    target=loc,
                    properties={"description": f"{pkg} at {loc}"}
                ))

            elif name == "at-truck":
                truck, loc = params
                visual_relations.append(VisualRelation(
                    type="at-truck",
                    source=truck,
                    target=loc,
                    properties={"description": f"{truck} at {loc}"}
                ))

            elif name == "in-truck":
                pkg, truck = params
                visual_relations.append(VisualRelation(
                    type="in-truck",
                    source=pkg,
                    target=truck,
                    properties={"description": f"{pkg} in {truck}"}
                ))

        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )

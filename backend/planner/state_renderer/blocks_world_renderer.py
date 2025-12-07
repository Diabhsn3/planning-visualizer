"""
Blocks World State Renderer - domain-specific rendering for blocks world.

Renders blocks with vertical stacking layout and visual properties.
"""

from typing import Dict, List, Set, Optional, Any
from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class BlocksWorldRenderer(BaseStateRenderer):
    """
    Renderer for Blocks World domain.
    
    Features:
    - Vertical stacking layout
    - Color coding for blocks
    - Hand/gripper state visualization
    - Table representation
    """
    
    # Default colors for blocks (can be customized)
    BLOCK_COLORS = {
        'a': '#FF6B6B',  # Red
        'b': '#4ECDC4',  # Teal
        'c': '#45B7D1',  # Blue
        'd': '#FFA07A',  # Light Salmon
        'e': '#98D8C8',  # Mint
        'f': '#F7DC6F',  # Yellow
        'g': '#BB8FCE',  # Purple
        'h': '#85C1E2',  # Sky Blue
    }
    
    def __init__(self):
        super().__init__("blocks-world")
        self.block_size = 60  # Size of each block in pixels
        self.spacing = 80     # Horizontal spacing between stacks
        self.table_y = 500    # Y position of the table (increased for more vertical space)
    
    def render(self, state: Set, objects: Dict[str, str], metadata: Optional[Dict] = None) -> RenderedState:
        """
        Render blocks world state with spatial layout.
        
        Args:
            state: Set of predicates
            objects: Object name to type mapping
            metadata: Optional metadata
            
        Returns:
            RenderedState with positioned blocks
        """
        # Extract blocks (filter out type definitions)
        blocks = {name for name, obj_type in objects.items() 
                 if obj_type == 'block' and name != 'block'}
        
        # Build state information
        on_relations = {}      # block -> block it's on
        ontable_blocks = set() # blocks on table
        clear_blocks = set()   # clear blocks
        holding_block = None   # block being held
        hand_empty = False
        
        for pred in state:
            if pred.name == 'on' and len(pred.params) == 2:
                on_relations[pred.params[0]] = pred.params[1]
            elif pred.name == 'ontable' and len(pred.params) == 1:
                ontable_blocks.add(pred.params[0])
            elif pred.name == 'clear' and len(pred.params) == 1:
                clear_blocks.add(pred.params[0])
            elif pred.name == 'holding' and len(pred.params) == 1:
                holding_block = pred.params[0]
            elif pred.name == 'handempty':
                hand_empty = True
        
        # Build stacks from bottom to top
        stacks = self._build_stacks(blocks, on_relations, ontable_blocks)
        
        # Assign fixed X positions to all blocks based on alphabetical order
        # This ensures blocks maintain their horizontal position throughout the animation
        sorted_blocks = sorted(blocks)
        block_x_positions = {}
        x_offset = 50
        for block in sorted_blocks:
            block_x_positions[block] = x_offset
            x_offset += self.spacing
        
        # Position blocks
        visual_objects = []
        visual_relations = []
        
        # Position each stack using fixed X coordinates
        for stack in stacks:
            # Get the X position from the bottom block of the stack
            bottom_block = stack[0]
            stack_x = block_x_positions[bottom_block]
            y_pos = self.table_y - self.block_size  # Start above the table
            
            for i, block in enumerate(stack):
                # Use fixed X position for this block
                position = [stack_x, y_pos]
                
                # Create visual object
                color = self.BLOCK_COLORS.get(block, '#95A5A6')
                is_clear = block in clear_blocks
                
                visual_obj = VisualObject(
                    id=block,
                    type='block',
                    label=block.upper(),
                    position=position,
                    properties={
                        'color': color,
                        'width': self.block_size,
                        'height': self.block_size,
                        'clear': is_clear,
                        'z_index': i
                    }
                )
                visual_objects.append(visual_obj)
                
                # Move up for next block
                y_pos -= self.block_size
        
        # Add block being held (if any)
        if holding_block:
            # Use the block's fixed X position even when held
            held_x = block_x_positions.get(holding_block, x_offset)
            visual_obj = VisualObject(
                id=holding_block,
                type='block',
                label=holding_block.upper(),
                position=[held_x, self.table_y - 290],  # Above table, at block's fixed X
                properties={
                    'color': self.BLOCK_COLORS.get(holding_block, '#95A5A6'),
                    'width': self.block_size,
                    'height': self.block_size,
                    'held': True,
                    'z_index': 100
                }
            )
            visual_objects.append(visual_obj)
        
        # Add table
        table = VisualObject(
            id='table',
            type='surface',
            label='Table',
            position=[0, self.table_y],
            properties={
                'width': x_offset + 50,
                'height': 20,
                'color': '#8B4513'
            }
        )
        visual_objects.append(table)
        
        # Add gripper/hand
        # Position gripper above the held block, or at the rightmost position
        gripper_x = block_x_positions.get(holding_block, x_offset) if holding_block else x_offset
        gripper = VisualObject(
            id='gripper',
            type='gripper',
            label='Hand',
            position=[gripper_x, self.table_y - 300],
            properties={
                'empty': hand_empty,
                'holding': holding_block
            }
        )
        visual_objects.append(gripper)
        
        # Create relations
        for block_above, block_below in on_relations.items():
            relation = VisualRelation(
                type='on',
                source=block_above,
                target=block_below,
                properties={'relationship': 'stacked'}
            )
            visual_relations.append(relation)
        
        for block in ontable_blocks:
            relation = VisualRelation(
                type='ontable',
                source=block,
                target='table',
                properties={'relationship': 'supported'}
            )
            visual_relations.append(relation)
        
        if holding_block:
            relation = VisualRelation(
                type='holding',
                source='gripper',
                target=holding_block,
                properties={'relationship': 'grasped'}
            )
            visual_relations.append(relation)
        
        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )
    
    def _build_stacks(self, blocks: Set[str], on_relations: Dict[str, str], 
                     ontable_blocks: Set[str]) -> List[List[str]]:
        """
        Build stacks from bottom to top.
        
        Args:
            blocks: Set of all blocks
            on_relations: Mapping of block -> block it's on
            ontable_blocks: Set of blocks on table
            
        Returns:
            List of stacks, where each stack is a list of blocks from bottom to top
        """
        stacks = []
        
        # Find all bottom blocks (on table)
        for bottom_block in sorted(ontable_blocks):
            stack = [bottom_block]
            
            # Build upward
            current = bottom_block
            while True:
                # Find block on top of current
                next_block = None
                for block_above, block_below in on_relations.items():
                    if block_below == current:
                        next_block = block_above
                        break
                
                if next_block:
                    stack.append(next_block)
                    current = next_block
                else:
                    break
            
            stacks.append(stack)
        
        return stacks

"""
State Generator - generates intermediate states by applying actions.
"""

from typing import List, Set, Dict, Tuple
from .pddl_parser import PDDLParser, Predicate, Action
import re
import sys


class StateGenerator:
    """
    Generates intermediate states from initial state and action sequence.
    """
    
    def __init__(self, domain_path: str, problem_path: str):
        """
        Initialize the state generator with PDDL domain and problem files.
        
        Args:
            domain_path: Path to domain PDDL file
            problem_path: Path to problem PDDL file
        """
        self.parser = PDDLParser(domain_path, problem_path)
        self.current_state: Set[Predicate] = set(self.parser.init_state)
        self.state_history: List[Set[Predicate]] = [set(self.current_state)]
    
    def reset(self):
        """Reset to initial state."""
        self.current_state = set(self.parser.init_state)
        self.state_history = [set(self.current_state)]
    
    def get_current_state(self) -> Set[Predicate]:
        """Get the current state as a set of predicates."""
        return set(self.current_state)
    
    def get_state_history(self) -> List[Set[Predicate]]:
        """Get the history of all states."""
        return [set(s) for s in self.state_history]
    
    def parse_grounded_action(self, grounded_action: str) -> Tuple[str, List[str]]:
        """
        Parse a grounded action string into action name and parameters.
        
        Example: "(pick-up a)" -> ("pick-up", ["a"])
                 "(stack a b)" -> ("stack", ["a", "b"])
        
        Args:
            grounded_action: Grounded action string from planner
            
        Returns:
            Tuple of (action_name, parameters)
        """
        # Remove parentheses and split
        grounded_action = grounded_action.strip()
        if grounded_action.startswith('(') and grounded_action.endswith(')'):
            grounded_action = grounded_action[1:-1]
        
        parts = grounded_action.split()
        action_name = parts[0]
        parameters = parts[1:] if len(parts) > 1 else []
        
        return action_name, parameters
    
    def ground_predicate(self, predicate: Predicate, binding: Dict[str, str]) -> Predicate:
        """
        Ground a predicate by substituting variables with concrete objects.
        
        Args:
            predicate: Predicate with variables
            binding: Variable to object mapping
            
        Returns:
            Grounded predicate
        """
        grounded_params = []
        for param in predicate.params:
            if param.startswith('?'):
                # It's a variable
                if param in binding:
                    grounded_params.append(binding[param])
                else:
                    raise ValueError(f"Variable {param} not found in binding")
            else:
                # It's already a constant
                grounded_params.append(param)
        
        return Predicate(predicate.name, grounded_params)
    
    def check_preconditions(self, action: Action, binding: Dict[str, str]) -> bool:
        """
        Check if action preconditions are satisfied in current state.
        
        Args:
            action: Action schema
            binding: Variable to object mapping
            
        Returns:
            True if preconditions are satisfied
        """
        for is_positive, pred in action.preconditions:
            grounded_pred = self.ground_predicate(pred, binding)
            
            if is_positive:
                # Positive precondition: must be in state
                if grounded_pred not in self.current_state:
                    return False
            else:
                # Negative precondition: must NOT be in state
                if grounded_pred in self.current_state:
                    return False
        
        return True
    
    def apply_effects(self, action: Action, binding: Dict[str, str]):
        """
        Apply action effects to current state.
        
        Args:
            action: Action schema
            binding: Variable to object mapping
        """
        for is_positive, pred in action.effects:
            grounded_pred = self.ground_predicate(pred, binding)
            
            if is_positive:
                # Add predicate to state
                self.current_state.add(grounded_pred)
            else:
                # Remove predicate from state
                self.current_state.discard(grounded_pred)
    
    def apply_action(self, grounded_action: str) -> bool:
        """
        Apply a grounded action to the current state.
        
        Args:
            grounded_action: Grounded action string (e.g., "(pick-up a)")
            
        Returns:
            True if action was successfully applied
        """
        # Parse grounded action
        action_name, params = self.parse_grounded_action(grounded_action)
        
        # Get action schema
        try:
            action = self.parser.get_action_by_name(action_name)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            return False
        
        # Create variable binding
        if len(params) != len(action.parameters):
            print(f"Error: Parameter count mismatch for action {action_name}", file=sys.stderr)
            return False
        
        binding = {}
        for (var_name, var_type), obj in zip(action.parameters, params):
            binding[var_name] = obj
        
        # Check preconditions
        if not self.check_preconditions(action, binding):
            print(f"Warning: Preconditions not satisfied for action {grounded_action}", file=sys.stderr)
            return False
        
        # Apply effects
        self.apply_effects(action, binding)
        
        # Save state to history
        self.state_history.append(set(self.current_state))
        
        return True
    
    def apply_plan(self, plan: List[str]) -> List[Set[Predicate]]:
        """
        Apply a sequence of actions (plan) to generate all intermediate states.
        
        Args:
            plan: List of grounded action strings
            
        Returns:
            List of states (including initial state)
        """
        self.reset()
        
        for i, action in enumerate(plan):
            success = self.apply_action(action)
            if not success:
                print(f"Failed to apply action {i}: {action}", file=sys.stderr)
                break
        
        return self.get_state_history()
    
    def state_to_dict(self, state: Set[Predicate]) -> Dict:
        """
        Convert a state to a dictionary representation for JSON serialization.
        
        Args:
            state: Set of predicates
            
        Returns:
            Dictionary with predicates grouped by name
        """
        result = {}
        for pred in state:
            if pred.name not in result:
                result[pred.name] = []
            result[pred.name].append(pred.params)
        return result
    
    def generate_states_json(self, plan: List[str]) -> List[Dict]:
        """
        Generate all states and return as JSON-serializable list.
        
        Args:
            plan: List of grounded action strings
            
        Returns:
            List of state dictionaries
        """
        states = self.apply_plan(plan)
        return [self.state_to_dict(state) for state in states]

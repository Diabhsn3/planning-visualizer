"""
PDDL Parser for Domain and Problem files.
Extracts objects, initial state, actions with preconditions and effects.
"""

import re
from dataclasses import dataclass
from typing import List, Set, Dict, Tuple


@dataclass
class Predicate:
    """Represents a predicate with name and parameters."""
    name: str
    params: List[str]
    
    def __str__(self):
        if self.params:
            return f"({self.name} {' '.join(self.params)})"
        return f"({self.name})"
    
    def __hash__(self):
        return hash((self.name, tuple(self.params)))
    
    def __eq__(self, other):
        return self.name == other.name and self.params == other.params


@dataclass
class Action:
    """Represents a PDDL action with parameters, preconditions, and effects."""
    name: str
    parameters: List[Tuple[str, str]]  # [(var_name, type), ...]
    preconditions: List[Tuple[bool, Predicate]]  # [(is_positive, predicate), ...]
    effects: List[Tuple[bool, Predicate]]  # [(is_positive, predicate), ...]
    
    def __str__(self):
        return f"Action({self.name})"


class PDDLParser:
    """Parser for PDDL domain and problem files."""
    
    def __init__(self, domain_path: str, problem_path: str):
        self.domain_path = domain_path
        self.problem_path = problem_path
        
        # Domain data
        self.domain_name = ""
        self.types: Dict[str, str] = {}  # object -> type
        self.predicates_schema: List[Tuple[str, List[str]]] = []  # [(name, [types]), ...]
        self.actions: Dict[str, Action] = {}  # action_name -> Action
        
        # Problem data
        self.problem_name = ""
        self.objects: Dict[str, str] = {}  # object_name -> type
        self.init_state: Set[Predicate] = set()
        self.goal: List[Tuple[bool, Predicate]] = []  # [(is_positive, predicate), ...]
        
        self._parse_domain()
        self._parse_problem()
    
    def _remove_comments(self, text: str) -> str:
        """Remove PDDL comments (lines starting with ;)."""
        lines = [line for line in text.split('\n') if not line.strip().startswith(';')]
        return '\n'.join(lines)
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize PDDL text into a list of tokens."""
        text = self._remove_comments(text)
        # Replace parentheses with spaces around them
        text = text.replace('(', ' ( ').replace(')', ' ) ')
        # Split and filter empty tokens
        tokens = [t for t in text.split() if t]
        return tokens
    
    def _parse_domain(self):
        """Parse the domain PDDL file."""
        with open(self.domain_path, 'r') as f:
            content = f.read()
        
        tokens = self._tokenize(content)
        self._parse_domain_tokens(tokens)
    
    def _parse_domain_tokens(self, tokens: List[str]):
        """Parse domain tokens."""
        i = 0
        while i < len(tokens):
            if tokens[i] == '(' and i + 1 < len(tokens):
                if tokens[i + 1] == 'define':
                    i = self._parse_define_domain(tokens, i)
                else:
                    i += 1
            else:
                i += 1
    
    def _parse_define_domain(self, tokens: List[str], start: int) -> int:
        """Parse (define (domain ...) ...) block."""
        i = start + 2  # Skip '(' and 'define'
        
        # Parse domain name
        if tokens[i] == '(' and tokens[i + 1] == 'domain':
            self.domain_name = tokens[i + 2]
            i += 4  # Skip '(', 'domain', name, ')'
        
        # Parse sections
        while i < len(tokens):
            if tokens[i] == '(' and i + 1 < len(tokens):
                keyword = tokens[i + 1]
                if keyword == ':requirements':
                    i = self._skip_section(tokens, i)
                elif keyword == ':types':
                    i = self._skip_section(tokens, i)
                elif keyword == ':predicates':
                    i = self._parse_predicates(tokens, i)
                elif keyword == ':action':
                    i = self._parse_action(tokens, i)
                else:
                    i += 1
            elif tokens[i] == ')':
                return i + 1
            else:
                i += 1
        return i
    
    def _skip_section(self, tokens: List[str], start: int) -> int:
        """Skip a section by counting parentheses."""
        depth = 0
        i = start
        while i < len(tokens):
            if tokens[i] == '(':
                depth += 1
            elif tokens[i] == ')':
                depth -= 1
                if depth == 0:
                    return i + 1
            i += 1
        return i
    
    def _parse_predicates(self, tokens: List[str], start: int) -> int:
        """Parse (:predicates ...) section."""
        i = start + 2  # Skip '(' and ':predicates'
        
        while i < len(tokens):
            if tokens[i] == '(':
                # Parse single predicate schema
                pred_tokens = []
                depth = 0
                j = i
                while j < len(tokens):
                    if tokens[j] == '(':
                        depth += 1
                    elif tokens[j] == ')':
                        depth -= 1
                        if depth == 0:
                            pred_tokens = tokens[i + 1:j]
                            i = j + 1
                            break
                    j += 1
                
                if pred_tokens:
                    pred_name = pred_tokens[0]
                    # Extract types (simplified - just count parameters)
                    param_types = []
                    for token in pred_tokens[1:]:
                        if token.startswith('?'):
                            param_types.append('object')
                    self.predicates_schema.append((pred_name, param_types))
            elif tokens[i] == ')':
                return i + 1
            else:
                i += 1
        return i
    
    def _parse_action(self, tokens: List[str], start: int) -> int:
        """Parse (:action ...) block."""
        i = start + 2  # Skip '(' and ':action'
        action_name = tokens[i]
        i += 1
        
        parameters = []
        preconditions = []
        effects = []
        
        while i < len(tokens):
            if tokens[i] == ':parameters':
                i, parameters = self._parse_parameters(tokens, i + 1)
            elif tokens[i] == ':precondition':
                i, preconditions = self._parse_condition(tokens, i + 1)
            elif tokens[i] == ':effect':
                i, effects = self._parse_effect(tokens, i + 1)
            elif tokens[i] == ')':
                # End of action
                action = Action(action_name, parameters, preconditions, effects)
                self.actions[action_name] = action
                return i + 1
            else:
                i += 1
        
        return i
    
    def _parse_parameters(self, tokens: List[str], start: int) -> Tuple[int, List[Tuple[str, str]]]:
        """Parse :parameters (?x - type ...) section."""
        params = []
        i = start
        
        if tokens[i] == '(':
            i += 1
            while i < len(tokens) and tokens[i] != ')':
                if tokens[i].startswith('?'):
                    var_name = tokens[i]
                    var_type = 'object'  # default
                    if i + 1 < len(tokens) and tokens[i + 1] == '-':
                        var_type = tokens[i + 2]
                        i += 3
                    else:
                        i += 1
                    params.append((var_name, var_type))
                else:
                    i += 1
            i += 1  # Skip closing ')'
        
        return i, params
    
    def _parse_condition(self, tokens: List[str], start: int) -> Tuple[int, List[Tuple[bool, Predicate]]]:
        """Parse precondition or goal condition."""
        conditions = []
        i = start
        
        if tokens[i] == '(':
            i += 1
            if tokens[i] == 'and':
                i += 1
                while i < len(tokens):
                    if tokens[i] == '(':
                        is_positive = True
                        j = i + 1
                        if tokens[j] == 'not':
                            is_positive = False
                            j += 2  # Skip 'not' and '('
                        
                        # Parse predicate
                        pred_tokens = []
                        depth = 0
                        k = j - 1
                        while k < len(tokens):
                            if tokens[k] == '(':
                                depth += 1
                            elif tokens[k] == ')':
                                depth -= 1
                                if depth == 0:
                                    if is_positive:
                                        pred_tokens = tokens[j:k]
                                    else:
                                        pred_tokens = tokens[j:k]
                                        k += 1  # Extra ')' for not
                                    i = k + 1
                                    break
                            k += 1
                        
                        if pred_tokens:
                            pred_name = pred_tokens[0]
                            pred_params = [p for p in pred_tokens[1:] if p != '-' and not p.startswith('?') or p.startswith('?')]
                            predicate = Predicate(pred_name, pred_params)
                            conditions.append((is_positive, predicate))
                    elif tokens[i] == ')':
                        i += 1
                        break
                    else:
                        i += 1
            else:
                # Single condition (no 'and')
                is_positive = True
                if tokens[i] == 'not':
                    is_positive = False
                    i += 2  # Skip 'not' and '('
                
                pred_tokens = []
                depth = 0
                j = i
                while j < len(tokens):
                    if tokens[j] == '(':
                        depth += 1
                    elif tokens[j] == ')':
                        depth -= 1
                        if depth == -1:
                            pred_tokens = tokens[i:j]
                            i = j + 1
                            if not is_positive:
                                i += 1  # Extra ')' for not
                            break
                    j += 1
                
                if pred_tokens:
                    pred_name = pred_tokens[0]
                    pred_params = [p for p in pred_tokens[1:]]
                    predicate = Predicate(pred_name, pred_params)
                    conditions.append((is_positive, predicate))
        
        return i, conditions
    
    def _parse_effect(self, tokens: List[str], start: int) -> Tuple[int, List[Tuple[bool, Predicate]]]:
        """Parse effect section (similar to condition)."""
        return self._parse_condition(tokens, start)
    
    def _parse_problem(self):
        """Parse the problem PDDL file."""
        with open(self.problem_path, 'r') as f:
            content = f.read()
        
        tokens = self._tokenize(content)
        self._parse_problem_tokens(tokens)
    
    def _parse_problem_tokens(self, tokens: List[str]):
        """Parse problem tokens."""
        i = 0
        while i < len(tokens):
            if tokens[i] == '(' and i + 1 < len(tokens):
                if tokens[i + 1] == 'define':
                    i = self._parse_define_problem(tokens, i)
                else:
                    i += 1
            else:
                i += 1
    
    def _parse_define_problem(self, tokens: List[str], start: int) -> int:
        """Parse (define (problem ...) ...) block."""
        i = start + 2  # Skip '(' and 'define'
        
        # Parse problem name
        if tokens[i] == '(' and tokens[i + 1] == 'problem':
            self.problem_name = tokens[i + 2]
            i += 4  # Skip '(', 'problem', name, ')'
        
        # Parse sections
        while i < len(tokens):
            if tokens[i] == '(' and i + 1 < len(tokens):
                keyword = tokens[i + 1]
                if keyword == ':domain':
                    i = self._skip_section(tokens, i)
                elif keyword == ':objects':
                    i = self._parse_objects(tokens, i)
                elif keyword == ':init':
                    i = self._parse_init(tokens, i)
                elif keyword == ':goal':
                    i = self._parse_goal(tokens, i)
                else:
                    i += 1
            elif tokens[i] == ')':
                return i + 1
            else:
                i += 1
        return i
    
    def _parse_objects(self, tokens: List[str], start: int) -> int:
        """Parse (:objects ...) section."""
        i = start + 2  # Skip '(' and ':objects'
        
        while i < len(tokens):
            if tokens[i].startswith('?'):
                i += 1
            elif tokens[i] == '-':
                # Type specification
                obj_type = tokens[i + 1]
                # Go back and assign type to previous objects
                j = i - 1
                while j >= start + 2 and tokens[j] not in ['(', ')', '-']:
                    if not tokens[j].startswith(':'):
                        self.objects[tokens[j]] = obj_type
                    j -= 1
                i += 2
            elif tokens[i] == ')':
                # Assign default type to remaining objects
                j = i - 1
                while j >= start + 2 and tokens[j] not in ['(', ')', '-']:
                    if tokens[j] not in self.objects and not tokens[j].startswith(':'):
                        self.objects[tokens[j]] = 'object'
                    j -= 1
                return i + 1
            else:
                i += 1
        return i
    
    def _parse_init(self, tokens: List[str], start: int) -> int:
        """Parse (:init ...) section."""
        i = start + 2  # Skip '(' and ':init'
        
        while i < len(tokens):
            if tokens[i] == '(':
                # Parse predicate
                pred_tokens = []
                depth = 0
                j = i
                while j < len(tokens):
                    if tokens[j] == '(':
                        depth += 1
                    elif tokens[j] == ')':
                        depth -= 1
                        if depth == 0:
                            pred_tokens = tokens[i + 1:j]
                            i = j + 1
                            break
                    j += 1
                
                if pred_tokens:
                    pred_name = pred_tokens[0]
                    pred_params = [p for p in pred_tokens[1:] if p != '-']
                    predicate = Predicate(pred_name, pred_params)
                    self.init_state.add(predicate)
            elif tokens[i] == ')':
                return i + 1
            else:
                i += 1
        return i
    
    def _parse_goal(self, tokens: List[str], start: int) -> int:
        """Parse (:goal ...) section."""
        i = start + 2  # Skip '(' and ':goal'
        i, self.goal = self._parse_condition(tokens, i)
        return i
    
    def get_action_by_name(self, action_name: str) -> Action:
        """Get action schema by name (without parameters)."""
        for name, action in self.actions.items():
            if name == action_name:
                return action
        raise ValueError(f"Action {action_name} not found in domain")

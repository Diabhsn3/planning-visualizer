(define (domain depot)
  (:requirements :strips :typing)
  
  (:types
      depot
      truck
      crane
      pile
      package
  )

  (:predicates
      ;; locations
      (at-truck ?t - truck ?d - depot)
      (at-crane ?c - crane ?d - depot)
      (at-pile ?pl - pile ?d - depot)

      ;; stacking relations
      (on ?p - package ?q - package)
      (on-pile ?p - package ?pl - pile)
      (clear ?x)                    ;; ?x = package or pile top free

      ;; crane state
      (holding ?c - crane ?p - package)
      (empty-crane ?c - crane)

      ;; truck cargo
      (in-truck ?p - package ?t - truck)
  )

  ;; --------------------
  ;; Truck movement
  ;; --------------------
  (:action drive
    :parameters (?t - truck ?from - depot ?to - depot)
    :precondition (at-truck ?t ?from)
    :effect (and
        (not (at-truck ?t ?from))
        (at-truck ?t ?to))
  )

  ;; --------------------
  ;; Crane picks from pile
  ;; --------------------
  (:action lift
    :parameters (?c - crane ?p - package ?pl - pile ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (at-pile ?pl ?d)
        (on-pile ?p ?pl)
        (clear ?p)
        (empty-crane ?c))
    :effect (and
        (not (on-pile ?p ?pl))
        (holding ?c ?p)
        (not (clear ?p))
        (clear ?pl)
        (not (empty-crane ?c)))
  )

  ;; --------------------
  ;; Crane picks from package
  ;; --------------------
  (:action unstack
    :parameters (?c - crane ?p - package ?q - package ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (on ?p ?q)
        (clear ?p)
        (empty-crane ?c))
    :effect (and
        (not (on ?p ?q))
        (holding ?c ?p)
        (clear ?q)
        (not (clear ?p))
        (not (empty-crane ?c)))
  )

  ;; --------------------
  ;; Crane drops onto pile
  ;; --------------------
  (:action drop
    :parameters (?c - crane ?p - package ?pl - pile ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (at-pile ?pl ?d)
        (holding ?c ?p)
        (clear ?pl))
    :effect (and
        (on-pile ?p ?pl)
        (clear ?p)
        (empty-crane ?c)
        (not (holding ?c ?p))
        (not (clear ?pl)))
  )

  ;; --------------------
  ;; Crane stacks onto package
  ;; --------------------
  (:action stack
    :parameters (?c - crane ?p - package ?q - package ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (holding ?c ?p)
        (clear ?q))
    :effect (and
        (on ?p ?q)
        (clear ?p)
        (empty-crane ?c)
        (not (holding ?c ?p))
        (not (clear ?q)))
  )

  ;; --------------------
  ;; Load to truck
  ;; --------------------
  (:action load
    :parameters (?c - crane ?p - package ?t - truck ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (at-truck ?t ?d)
        (holding ?c ?p))
    :effect (and
        (in-truck ?p ?t)
        (empty-crane ?c)
        (not (holding ?c ?p)))
  )

  ;; --------------------
  ;; Unload from truck (package goes to crane, not pile)
  ;; --------------------
  (:action unload
    :parameters (?c - crane ?p - package ?t - truck ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (at-truck ?t ?d)
        (in-truck ?p ?t)
        (empty-crane ?c))
    :effect (and
        (holding ?c ?p)
        (not (in-truck ?p ?t))
        (not (empty-crane ?c)))
  )
)

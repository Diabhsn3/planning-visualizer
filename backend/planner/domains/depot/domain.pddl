(define (domain depot)
  (:requirements :strips :typing)
  
  (:types
      depot
      truck
      crane
      surface              ;; common supertype for things that can be clear
      package pile - surface   ;; both package and pile are surfaces
  )

  (:predicates
      ;; locations
      (at-truck ?t - truck ?d - depot)
      (at-crane ?c - crane ?d - depot)
      (at-pile ?pl - pile ?d - depot)

      ;; stacking relations
      (on ?p - package ?s - surface)    ;; package on another surface (package or pile)
      
      ;; clear predicate - works for both packages and piles
      (clear ?s - surface)

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
  ;; Crane picks package from a surface (pile or another package)
  ;; --------------------
  (:action lift
    :parameters (?c - crane ?p - package ?s - surface ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (on ?p ?s)
        (clear ?p)
        (empty-crane ?c))
    :effect (and
        (not (on ?p ?s))
        (holding ?c ?p)
        (not (clear ?p))
        (clear ?s)
        (not (empty-crane ?c)))
  )

  ;; --------------------
  ;; Crane drops package onto a surface (pile or another package)
  ;; --------------------
  (:action drop
    :parameters (?c - crane ?p - package ?s - surface ?d - depot)
    :precondition (and
        (at-crane ?c ?d)
        (holding ?c ?p)
        (clear ?s))
    :effect (and
        (on ?p ?s)
        (clear ?p)
        (empty-crane ?c)
        (not (holding ?c ?p))
        (not (clear ?s)))
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
  ;; Unload from truck (package goes to crane)
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

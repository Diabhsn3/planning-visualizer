(define (domain ferry)
  (:requirements :strips :typing)
  (:types car location)

  (:predicates
    (at-ferry ?l - location)
    (at ?c - car ?l - location)
    (on ?c - car)
    (empty-ferry)
  )

  (:action sail
    :parameters (?from - location ?to - location)
    :precondition (at-ferry ?from)
    :effect (and (not (at-ferry ?from)) (at-ferry ?to))
  )

  (:action board
    :parameters (?c - car ?l - location)
    :precondition (and (at ?c ?l) (at-ferry ?l) (empty-ferry))
    :effect (and (not (at ?c ?l)) (not (empty-ferry)) (on ?c))
  )

  (:action debark
    :parameters (?c - car ?l - location)
    :precondition (and (on ?c) (at-ferry ?l))
    :effect (and (not (on ?c)) (at ?c ?l) (empty-ferry))
  )
)

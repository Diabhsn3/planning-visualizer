(define (domain hanoi)
  (:requirements :strips :typing)
  (:types
    disk
    peg
  )

  (:predicates
    ;; disk d is currently on peg p
    (on ?d - disk ?p - peg)
  )

  (:action move
    :parameters (?d - disk ?from - peg ?to - peg)
    :precondition (and
      (on ?d ?from)
      (not (= ?from ?to))
    )
    :effect (and
      (not (on ?d ?from))
      (on ?d ?to)
    )
  )
)


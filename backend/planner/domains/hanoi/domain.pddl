(define (domain hanoi)
  (:requirements :strips :typing :equality)

  (:types
    place
    disk peg - place
  )

  (:predicates
    (on ?d - disk ?x - place)
    (clear ?x - place)
    (smaller ?d1 - disk ?d2 - disk)

    ;; explicit "type tests" as predicates (FD-friendly)
    (is-disk ?x - place)
    (is-peg  ?x - place)
  )

  (:action move
    :parameters (?d - disk ?from - place ?to - place)
    :precondition (and
      (on ?d ?from)
      (clear ?d)
      (clear ?to)
      (not (= ?from ?to))

      ;; allowed destinations:
      ;; - any peg
      ;; - or a larger disk
      (or
        (is-peg ?to)
        (and (is-disk ?to) (smaller ?d ?to))
      )
    )
    :effect (and
      (not (on ?d ?from))
      (on ?d ?to)
      (clear ?from)
      (not (clear ?to))
    )
  )
)

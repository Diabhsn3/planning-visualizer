(define (domain hanoi)
  (:requirements :strips :typing)
  (:types disk peg)

  (:predicates
    (on ?d - disk ?x - (either disk peg))  ; disk is on a disk or a peg
    (clear ?x - (either disk peg))        ; nothing is on top of x
    (smaller ?d1 - disk ?d2 - disk)       ; d1 is smaller than d2
  )

  (:action move
    :parameters (?d - disk ?from - (either disk peg) ?to - (either disk peg))
    :precondition (and
      (on ?d ?from)
      (clear ?d)
      (clear ?to)
      (not (= ?from ?to))
      ;; if destination is a disk, it must be larger than ?d
      (or (not (disk ?to)) (smaller ?d ?to))
    )
    :effect (and
      (not (on ?d ?from))
      (on ?d ?to)
      (clear ?from)
      (not (clear ?to))
    )
  )
)

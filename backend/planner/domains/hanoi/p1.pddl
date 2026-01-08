(define (problem hanoi-2-disks)
  (:domain hanoi)

  (:objects
    d1 d2 - disk
    a b c - peg
  )

  (:init
    ;; mark places
    (is-disk d1) (is-disk d2)
    (is-peg a) (is-peg b) (is-peg c)

    ;; size
    (smaller d1 d2)

    ;; initial stack: d1 on d2 on a
    (on d2 a)
    (on d1 d2)

    ;; clear facts
    (clear d1)
    (clear b)
    (clear c)
  )

  (:goal
    (and
      (on d2 c)
      (on d1 d2)
    )
  )
)

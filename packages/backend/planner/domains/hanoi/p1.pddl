(define (problem hanoi-p1)
  (:domain hanoi)

  (:objects
    d1 d2 d3 - disk
    p1 p2 p3 - peg
  )

  (:init
    (on d1 p1)
    (on d2 p1)
    (on d3 p1)
  )

  (:goal
    (and
      (on d1 p3)
      (on d2 p3)
      (on d3 p3)
    )
  )
)

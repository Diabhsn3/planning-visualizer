(define (problem bw-example-1)
  (:domain blocks-world)

  (:objects
    a b c - block
  )

  (:init
    ;; Initial configuration:
    ;;  - A and B are on the table
    ;;  - C is on top of A
    (ontable a)
    (ontable b)
    (on c a)

    ;; Clear blocks
    (clear c)
    (clear b)

    ;; Hand is empty at the start
    (handempty)
  )

  ;; Goal configuration:
  ;;  - A at the bottom (on the table)
  ;;  - B on A
  ;;  - C on B
  (:goal
    (and
      (ontable a)
      (on b a)
      (on c b)
      (clear c)
    )
  )
)
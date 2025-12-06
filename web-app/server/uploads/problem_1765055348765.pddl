(define (problem bw-example-3)
  (:domain blocks-world)

  (:objects
    a b c d - block
  )

  (:init
    ;; Initial configuration:
    ;;      b           d
    ;;      |           |
    ;;      a     c-----
    ;;  ----------------- (table)
    (ontable a)
    (ontable c)
    (on b a)
    (on d c)

    (clear b)
    (clear d)
    (handempty)
  )

  ;; Goal configuration:
  ;;      d
  ;;      |
  ;;      b
  ;;      |
  ;;      c
  ;;      |
  ;;      a
  ;;  ----------------- (table)
  (:goal
    (and
      (ontable a)
      (on c a)
      (on b c)
      (on d b)
      (clear d)
    )
  )
)
(define (problem bw-advanced-20-blocks)
  (:domain blocks-world)

  (:objects
    a b c d e f g h i j k l m n o p q r s t - block
  )

  (:init
    ;; Initial configuration:
    ;;   Stack 1: d on c on b on a
    ;;   Stack 2: h on g on f on e
    ;;   Stack 3: l on k on j on i
    ;;   Stack 4: p on o on n on m
    ;;   Stack 5: t on s on r on q
    ;;
    ;;  d         h         l         p         t
    ;;  |         |         |         |         |
    ;;  c         g         k         o         s
    ;;  |         |         |         |         |
    ;;  b         f         j         n         r
    ;;  |         |         |         |         |
    ;;  a         e         i         m         q
    ;; ---------------------------------------------
    (ontable a)
    (on b a)
    (on c b)
    (on d c)

    (ontable e)
    (on f e)
    (on g f)
    (on h g)

    (ontable i)
    (on j i)
    (on k j)
    (on l k)

    (ontable m)
    (on n m)
    (on o n)
    (on p o)

    (ontable q)
    (on r q)
    (on s r)
    (on t s)

    ;; Clear tops of each stack
    (clear d)
    (clear h)
    (clear l)
    (clear p)
    (clear t)

    ;; Hand starts empty
    (handempty)
  )

  ;; Goal: one tall tower a..t in order:
  ;;
  ;;                t
  ;;                |
  ;;                s
  ;;                |
  ;;                r
  ;;                |
  ;;                q
  ;;                |
  ;;                p
  ;;                |
  ;;                o
  ;;                |
  ;;                n
  ;;                |
  ;;                m
  ;;                |
  ;;                l
  ;;                |
  ;;                k
  ;;                |
  ;;                j
  ;;                |
  ;;                i
  ;;                |
  ;;                h
  ;;                |
  ;;                g
  ;;                |
  ;;                f
  ;;                |
  ;;                e
  ;;                |
  ;;                d
  ;;                |
  ;;                c
  ;;                |
  ;;                b
  ;;                |
  ;;                a
  ;; ---------------------------------------------
  (:goal
    (and
      (ontable a)
      (on b a)
      (on c b)
      (on d c)
      (on e d)
      (on f e)
      (on g f)
      (on h g)
      (on i h)
      (on j i)
      (on k j)
      (on l k)
      (on m l)
      (on n m)
      (on o n)
      (on p o)
      (on q p)
      (on r q)
      (on s r)
      (on t s)
      (clear t)
    )
  )
)
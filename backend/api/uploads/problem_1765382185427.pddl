(define (problem gripper-advanced-1)
  (:domain gripper)

  (:objects
    room-a room-b room-c room-d - room
    ball-1 ball-2 ball-3
    ball-4 ball-5 ball-6
    ball-7 ball-8             - ball
    left-gripper right-gripper - gripper
  )

  (:init
    ;; Robot starts in room-a
    (at-robby room-a)

    ;; Both grippers start free
    (free left-gripper)
    (free right-gripper)

    ;; Balls scattered across rooms
    (at ball-1 room-a)
    (at ball-2 room-a)
    (at ball-3 room-b)

    (at ball-4 room-b)
    (at ball-5 room-c)
    (at ball-6 room-c)

    (at ball-7 room-d)
    (at ball-8 room-d)
  )

  ;; Goal: redistribute balls to specific target rooms
  ;; - ball-1, ball-2, ball-3 -> room-d
  ;; - ball-4, ball-5, ball-6 -> room-c
  ;; - ball-7, ball-8 -> room-b
  (:goal
    (and
      (at ball-1 room-d)
      (at ball-2 room-d)
      (at ball-3 room-d)

      (at ball-4 room-c)
      (at ball-5 room-c)
      (at ball-6 room-c)

      (at ball-7 room-b)
      (at ball-8 room-b)
    )
  )
)
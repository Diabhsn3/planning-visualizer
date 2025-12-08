(define (domain satellite)
  (:requirements :strips :typing)
  (:types
    satellite
    instrument
    direction
    mode
    groundstation
  )

  (:predicates
    ;; satellite orientation
    (pointing ?s - satellite ?d - direction)

    ;; instrument onboard relation
    (on-board ?i - instrument ?s - satellite)

    ;; instrument power + calibration
    (power-on ?i - instrument)
    (calibrated ?i - instrument)

    ;; instrument supports a mode
    (supports ?i - instrument ?m - mode)

    ;; captured and downlinked data
    (has-image ?d - direction ?m - mode)
    (downlinked ?d - direction ?m - mode ?g - groundstation)

    ;; visibility + link
    (visible ?d - direction ?g - groundstation)
    (link-available ?g - groundstation)
  )

  (:action turn
    :parameters (?s - satellite ?from - direction ?to - direction)
    :precondition (pointing ?s ?from)
    :effect (and
      (not (pointing ?s ?from))
      (pointing ?s ?to))
  )

  (:action switch-on
    :parameters (?i - instrument ?s - satellite)
    :precondition (on-board ?i ?s)
    :effect (power-on ?i)
  )

  (:action calibrate
    :parameters (?i - instrument ?s - satellite ?d - direction)
    :precondition (and
      (on-board ?i ?s)
      (power-on ?i)
      (pointing ?s ?d)
    )
    :effect (calibrated ?i)
  )

  (:action take-image
    :parameters (?s - satellite ?i - instrument ?d - direction ?m - mode)
    :precondition (and
      (on-board ?i ?s)
      (power-on ?i)
      (calibrated ?i)
      (supports ?i ?m)
      (pointing ?s ?d)
    )
    :effect (has-image ?d ?m)
  )

  (:action downlink
    :parameters (?s - satellite ?i - instrument ?d - direction ?m - mode ?g - groundstation)
    :precondition (and
      (has-image ?d ?m)
      (visible ?d ?g)
      (link-available ?g)
    )
    :effect (downlinked ?d ?m ?g)
  )
)

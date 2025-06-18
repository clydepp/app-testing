# Uses current zoom, real_center, imag_center to map the cursors (x, y) coordinates into a complex number

def pixel_to_complex(x, y, zoom, real_center, imag_center):
    SCREEN_WIDTH = 640
    SCREEN_HEIGHT = 480

    real_width = 3 / (2 ** zoom)
    imag_height = 2 / (2 ** zoom)

    step_real = real_width / SCREEN_WIDTH
    step_imag = imag_height / SCREEN_HEIGHT

    real_min = real_center - real_width / 2
    imag_max = imag_center + imag_height / 2

    real = real_min + step_real * x
    imag = imag_max - step_imag * y

    return [real, imag]
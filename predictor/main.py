import base64
from io import BytesIO
from os.path import join, abspath, dirname

from PIL import Image
from flask import Flask, send_from_directory, request, jsonify
import tensorflow as tf
import tensorflow_datasets as tfds
import numpy as np


IMG_WIDTH = 256
IMG_HEIGHT = 256
OUTPUT_CHANNELS = 3


@tf.function
def resize(image):
    image = tf.image.resize(image, [IMG_WIDTH, IMG_HEIGHT], method=tf.image.ResizeMethod.NEAREST_NEIGHBOR)
    return image


def normalize(image):
    image = tf.cast(image, tf.float32)
    image = (image / 127.5) - 1
    return image


def preprocess_image(image):
    image = resize(image)
    image = normalize(image)
    return image


def downsample(filters, size, apply_batchnorm=True):
    initializer = tf.random_normal_initializer(0., 0.02)
    result = tf.keras.Sequential()
    result.add(tf.keras.layers.Conv2D(filters,
                                      size,
                                      strides=2,
                                      padding="same",
                                      kernel_initializer=initializer, use_bias=False))
    if apply_batchnorm:
        result.add(tf.keras.layers.BatchNormalization())
    result.add(tf.keras.layers.LeakyReLU())
    return result


def upsample(filters, size, apply_dropout=False):
    initializer = tf.random_normal_initializer(0., 0.02)
    result = tf.keras.Sequential()
    result.add(tf.keras.layers.Conv2DTranspose(filters,
                                               size,
                                               strides=2,
                                               padding="same",
                                               kernel_initializer=initializer,
                                               use_bias=False))
    result.add(tf.keras.layers.BatchNormalization())
    if apply_dropout:
        result.add(tf.keras.layers.Dropout(0.5))
    result.add(tf.keras.layers.ReLU())
    return result


def Generator():
    inputs = tf.keras.layers.Input(shape=[IMG_WIDTH, IMG_HEIGHT, 3])
    down_stack = [
        downsample(64, 4, apply_batchnorm=False),
        downsample(128, 4),
        downsample(256, 4),
        downsample(512, 4),
        downsample(512, 4),
        downsample(512, 4),
        downsample(512, 4),
        downsample(512, 4),
    ]
    up_stack = [
        upsample(512, 4, apply_dropout=True),
        upsample(512, 4, apply_dropout=True),
        upsample(512, 4, apply_dropout=True),
        upsample(512, 4),
        upsample(256, 4),
        upsample(128, 4),
        upsample(64, 4),
    ]
    initializer = tf.random_normal_initializer(0., 0.02)
    last = tf.keras.layers.Conv2DTranspose(OUTPUT_CHANNELS,
                                           4,
                                           strides=2,
                                           padding="same",
                                           kernel_initializer=initializer,
                                           activation="tanh")
    x = inputs
    skips = []
    for down in down_stack:
        x = down(x)
        skips.append(x)
    skips = reversed(skips[:-1])
    for up, skip in zip(up_stack, skips):
        x = up(x)
        x = tf.keras.layers.Concatenate()([x, skip])
    x = last(x)
    return tf.keras.Model(inputs=inputs, outputs=x)


generator = Generator()


checkpoint = tf.train.Checkpoint(generator=generator)
checkpoint.restore(join(dirname(abspath(__file__)), "checkpoints", "pix2pix", "ckpt-40"))


app = Flask(__name__)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


@app.route("/")
def base():
    return send_from_directory(join("client", "public"), "index.html")


@app.route("/<path:path>")
def home(path):
    return send_from_directory(join("client", "public"), path)


@app.route("/predict", methods=["POST"])
def classify():
    image = request.json["image"]
    image = image.replace("data:image/png;base64,", "")
    image = Image.open(BytesIO(base64.b64decode(image)))
    image = image.convert('RGB')

    image = tf.convert_to_tensor(image)
    image = preprocess_image(image)
    image = image[tf.newaxis, ...]

    image = generator(image, training=True)

    image = tf.squeeze(image)
    image = tf.keras.preprocessing.image.array_to_img(image)

    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    image = base64.b64encode(buffer.getvalue())
    image = image.decode("ascii")
    image = "data:image/png;base64," + image

    return jsonify({"success": True, "image": image})


if __name__ == "__main__":
    app.run(debug=True, port=3000)

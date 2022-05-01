# Pushin 🅿️ots

Pushin 🅿️ots is a live pose-to-pottery generator that turns people and posture into elegant, diverse still life portraits of ceramic ware.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

What things you need to install the software:

```
Python 3.8.x
```

### Installing

A step by step guide that tell you how to get a development environment running.

1. Clone the repository:

```bash
git clone https://github.com/kazijawad/pose-pottery.git
```

2. Install necessary packages, an [Anaconda](https://www.anaconda.com) environment is recommended:

```bash
# Python Packages
conda create -n p-pottery python=3.8
conda activate p-pottery
pip install tensorflow tensorflow-datasets notebook matplotlib ipywidgets flask
```

3. Install each custom dataset inside the `datasets` folder:

```bash
tfds build
```

3. Run the application:

```bash
jupyter notebook
```

## Built With

- [TensorFlow](https://tensorflow.org)
- [p5.js](https://p5js.org)
- [Houdini](https://www.sidefx.com/products/houdini)
- [Cinema 4D](https://www.maxon.net/en/cinema-4d)
- [Octane Renderer](https://home.otoy.com/render/octane-render)

## Authors

- [Kazi Jawad](https://kazijawad.com)
- [Richard Zhou](https://www.richardczhou.com)
- [Michael Kim](https://maikool.com)

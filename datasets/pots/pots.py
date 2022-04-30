import tensorflow_datasets as tfds

class Pots(tfds.core.GeneratorBasedBuilder):
    VERSION = tfds.core.Version("1.0.0")
    RELEASE_NOTES = {"1.0.0": "Initial release."}

    def _info(self) -> tfds.core.DatasetInfo:
        """Returns the dataset metadata."""
        return tfds.core.DatasetInfo(
            builder=self,
            features=tfds.features.FeaturesDict({
                "image": tfds.features.Image(shape=(512, 512, 3)),
            }),
            supervised_keys=None,
            disable_shuffling=True
        )

    def _split_generators(self, dl_manager: tfds.download.DownloadManager):
        """Returns SplitGenerators."""
        path = dl_manager.download_and_extract("https://storage.googleapis.com/kazijawad-datasets/pots.zip")
        return {
            "train": self._generate_examples(path / "pots"),
        }

    def _generate_examples(self, path):
        """Yields examples."""
        for p in path.glob("*.jpg"):
            yield p.name, {"image": p}

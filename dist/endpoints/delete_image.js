import fsExtra from 'fs-extra';
import { Data } from '../utils/data.js';
import { getImageData } from '../utils/get_image_data.js';
import { removeAnImagePath } from '../utils/get_image_stat.js';
export async function deleteImage(req, res) {
    if (typeof (req.query.image_path) === "undefined") {
        return res.status(400).send({ success: false, message: "image_path is required" });
    }
    const path = '' + req.query.image_path;
    if (!path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return res
            .status(400)
            .send({ success: false, error: "Must have an image extension!" });
    }
    const client = Data.wledConfig.client;
    const imgData = await getImageData(client, 256, false, path);
    // only delete if the image comes back
    if (imgData.success && imgData.data?.meta.height) {
        await fsExtra.remove(`/app/img/${path}`, err => {
            if (err) {
                console.error(err);
                return res.status(500).send({ success: false, message: `Failed with error ${err}` });
            }
            removeAnImagePath({ path, created: 0 });
            return res.send({ success: true, message: "image deleted" });
        });
    }
    return res.status(400).send({ success: false, message: `Image not found` });
}
//# sourceMappingURL=delete_image.js.map
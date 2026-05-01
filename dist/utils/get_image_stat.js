import sharp from "sharp";
import { Data } from "./data.js";
import fsextra from 'fs-extra';
import _ from "underscore";
const { readdirSync, statSync } = fsextra;
let imageDirectoryCache = [];
let imageStatsCache = [];
export function returnAnImageStat(imgObj) {
    let { path } = imgObj;
    return sharp(`${Data.imageDirectoryPath}/${path}`)
        .metadata()
        .then(function (metadata) {
        return getImageStat(imgObj, metadata);
    })
        .catch((err) => {
        console.warn(`${path}: ${err}`);
        throw err;
    });
}
export function returnAnImageStatFromBuffer(imgObj, name) {
    return sharp(imgObj)
        .metadata()
        .then(function (metadata) {
        return getImageStat({ path: name, created: Number(new Date()) }, metadata);
    })
        .catch((err) => {
        console.warn(`${name}: ${err}`);
        throw err;
    });
}
export function addAnImageStat(theStat) {
    let idx = imageStatsCache.findIndex((v) => v.id == theStat.id);
    if (idx !== -1) {
        imageStatsCache[idx] = theStat;
        return;
    }
    imageStatsCache.push(theStat);
}
export function addAnImagePath(thePath) {
    let idx = imageDirectoryCache.findIndex((v) => v.path === thePath.path);
    if (idx !== -1) {
        imageDirectoryCache[idx] = thePath;
        return;
    }
    imageDirectoryCache.push(thePath);
}
export function removeAnImagePath(thePath) {
    let idx = imageDirectoryCache.findIndex((v) => v.path === thePath.path);
    if (idx !== -1) {
        imageDirectoryCache.splice(idx, 1);
        return;
    }
    imageDirectoryCache.push(thePath);
}
export async function getAllImageStats() {
    if (!_.isEmpty(imageStatsCache)) {
        // console.log({ msg: "returning imags fomr cache", imageStatsCache })
        return Promise.resolve(imageStatsCache);
    }
    var images = gatherAllImages(Data.imageDirectoryPath);
    console.log(`gathered ${images.length} images`);
    let output = [];
    var promises = Promise.all(images.map((imgObj) => {
        let { path, created } = imgObj;
        return sharp(`${Data.imageDirectoryPath}/${path}`)
            .metadata()
            .then(function (metadata) {
            output.push(getImageStat(imgObj, metadata));
        })
            .catch((err) => console.warn(`${path}: ${err}`));
    }));
    let results = await promises.then((results) => {
        imageStatsCache = output;
        console.log(`imageStatsCache has ${output.length} entries`);
        return output;
    });
    return results;
}
function getImageStat(imgObj, metadata) {
    const path = `${Data.staticImageBaseURL}/${imgObj.path}`;
    const created = imgObj.created;
    let { width, height, format, hasAlpha, pages, delay } = metadata;
    return {
        id: imgObj.path,
        path,
        created,
        width,
        height,
        format,
        hasAlpha,
        pages: pages ?? 1,
        delay: delay ?? []
    };
}
function gatherAllImages(basePath) {
    if (!_.isEmpty(imageDirectoryCache)) {
        console.log({ msg: "returning cached file values", imageDirectoryCache });
        return imageDirectoryCache;
    }
    const recursiveList = (dir, list) => {
        const inThisDir = readdirSync(dir);
        console.log({ inThisDir });
        _.each(inThisDir, (fileOrFolder) => {
            const conCatPath = `${dir}/${fileOrFolder}`;
            const stat = statSync(conCatPath);
            if (stat.isDirectory()) {
                list = recursiveList(conCatPath, list);
            }
            else if (fileOrFolder.match(/\.gif|\.jpg|\.png|\.jpeg/gi)) {
                // console.log({ stat });
                const path = conCatPath.substring(basePath.length + 1);
                const created = stat.birthtimeMs;
                list.push({ path, created });
            }
        });
        return list;
    };
    imageDirectoryCache = recursiveList(basePath, []);
    return imageDirectoryCache;
}
//# sourceMappingURL=get_image_stat.js.map
var doc = app.activeDocument;
var docName = doc.name.replace(/\.[^\.]+$/, '');
var docPath = doc.path;
var scale = "300%";
var extensionName = "@3x.png";

function exportScaledPNG() {
    doc.resizeImage(scale, scale, doc.resolution, ResampleMethod.BICUBIC);
    pngFile = File(docPath + "/" + docName + extensionName);
    if (pngFile.exists) {
        pngFile.remove();
    }
    pngSaveOptions = new PNGSaveOptions();
    pngSaveOptions.compression = 9;
    doc.saveAs(pngFile, pngSaveOptions, true, Extension.LOWERCASE);
    doc.activeHistoryState = doc.historyStates[doc.historyStates.length - 2];
    app.purge(PurgeTarget.HISTORYCACHES);
    doc.save();
}

try {
	exportScaledPNG();
} catch (e) {
    if (DialogModes.NO != app.playbackDisplayDialogs) {
        alert(e + " : " + e.line);
    }
}
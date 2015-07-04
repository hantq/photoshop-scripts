try
{
  // Prompt user to select iTunesArtwork file. Clicking "Cancel" returns null.
  var iTunesArtwork = File.openDialog('Select a sqaure PNG file that is at least 1024x1024.', '*.png', false);
  if (iTunesArtwork !== null) {
    var doc = open(iTunesArtwork, OpenDocumentType.PNG);
    if (!doc) {
      throw 'Something is wrong with the file.  Make sure it\'s a valid PNG file.';
    }

    var startState = doc.activeHistoryState;       // save for undo
    var initialPrefs = app.preferences.rulerUnits; // will restore at end
    app.preferences.rulerUnits = Units.PIXELS;     // use pixels

    if (doc.width !== doc.height) {
        throw 'Image is not square';
    } else if (doc.width < 1024 || doc.height < 1024) {
        throw 'Image is too small! Image must be at least 1024x1024 pixels.';
    }

    var destFolder = Folder.selectDialog('Choose an output folder');
    if (!destFolder) {
      throw '';
    }

    // Save icons in PNG using Save for Web.
    var sfw = new ExportOptionsSaveForWeb();
    sfw.format = SaveDocumentType.PNG;
    sfw.PNG8 = false; // use PNG-24
    sfw.transparency = true;
    doc.info = null;  // delete metadata

    var icons = [
      { name: 'iTunesArtwork',    size: 512},
      { name: 'iTunesArtwork@2x', size: 1024},
      { name: 'Icon',             size: 57},
      { name: 'Icon@2x',          size: 114},
      { name: 'Icon-72',          size: 72},
      { name: 'Icon-72@2x',       size: 144},
      { name: 'Icon-Small',       size: 29},
      { name: 'Icon-Small@2x',    size: 58},
      { name: 'Icon-Small-50',    size: 50},
      { name: 'Icon-Small-50@2x', size: 100}
    ];

    for (i = 0; i < icons.length; i++) {
      var icon = icons[i];
      doc.resizeImage(icon.size, icon.size, // width, height
                      null, ResampleMethod.BICUBICSHARPER);
      var destFileName = icon.name + '.png';
      if (icon.name === 'iTunesArtwork@2x' || icon.name === 'iTunesArtwork') {
        // iTunesArtwork files don't have an extension
        destFileName = icon.name;
      }
      doc.exportDocument(new File(destFolder + '/' + destFileName), ExportType.SAVEFORWEB, sfw);
      doc.activeHistoryState = startState; // undo resize
    }
    alert('iOS Icons created!');
  }
} catch (exception) {
	if (exception) {
    alert(exception);
  }
} finally {
    if (!doc)
      doc.close(SaveOptions.DONOTSAVECHANGES);
    app.preferences.rulerUnits = initialPrefs; // restore prefs
}
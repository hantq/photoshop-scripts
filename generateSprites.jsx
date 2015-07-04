if (typeof NETXUS === 'undefined') {
	var NETXUS = function () {};
}

NETXUS.RectanglePacker = function (width, height) {
	this.root = {};
	this.reset(width, height);
};

/*
	Resets the object to its initial state by initializing the internal variables

	Parameters:
		width - The containing rectangle maximum width as integer
		height - The containing rectangle maximum height as integer
*/
NETXUS.RectanglePacker.prototype.reset = function (width, height) {
	this.root.x = 0;
	this.root.y = 0;
	this.root.w = width;
	this.root.h = height;
	delete this.root.lft;
	delete this.root.rgt;
	this.usedWidth = 0;
	this.usedHeight = 0;
};

/*
	Returns the actual used dimensions of the containing rectangle.

	Returns:
		A object composed of the properties: 'w' for width and 'h' for height.
*/
NETXUS.RectanglePacker.prototype.getDimensions = function () {
	return {
		w: this.usedWidth,
		h: this.usedHeight
	};
};

/*
 	Finds a suitable place for the given rectangle

	Parameters:
		w - The rectangle width as integer.
		h - The rectangle height as integer.

	Returns:
		If there is room for the rectangle then returns the coordinates as an object
		composed of 'x' and 'y' properties.
		If it doesn't fit returns null
*/
NETXUS.RectanglePacker.prototype.findCoords = function (w, h) {
	// private function to traverse the node tree by recursion
	function recursiveFindCoords (node, w, h) {
		// private function to clone a node coords and size
		function cloneNode (node) {
			return {
				x: node.x,
				y: node.y,
				w: node.w,
				h: node.h
			};
		}
		// if we are not at a leaf then go deeper
		if (node.lft) {
			// check first the left branch if not found then go by the right
			var coords = recursiveFindCoords(node.lft, w, h);
			return coords ? coords : recursiveFindCoords(node.rgt, w, h);
		}
		else {
			// if already used or it's too big then return
			if (node.used || w > node.w || h > node.h)
				return null;
			// if it fits perfectly then use this gap
			if (w === node.w && h === node.h) {
				node.used = true;
				return {
					x: node.x,
					y: node.y
				};
			}
			// initialize the left and right leafs by clonning the current one
			node.lft = cloneNode(node);
			node.rgt = cloneNode(node);
			// checks if we partition in vertical or horizontal
			if (node.w - w > node.h - h) {
				node.lft.w = w;
				node.rgt.x = node.x + w;
				node.rgt.w = node.w - w;
			} else {
				node.lft.h = h;
				node.rgt.y = node.y + h;
				node.rgt.h = node.h - h;
			}
			return recursiveFindCoords(node.lft, w, h);
		}
	}
	// perform the search
	var coords = recursiveFindCoords(this.root, w, h);
	// if fitted then recalculate the used dimensions
	if (coords) {
		if (this.usedWidth < coords.x + w)
			this.usedWidth = coords.x + w;
		if (this.usedHeight < coords.y + h)
			this.usedHeight = coords.y + h;
	}
	return coords;
};

var defaultRulerUnits = preferences.rulerUnits;
preferences.rulerUnits = Units.PIXELS;

var Version = '0.1';
var srcFolder = new Folder();
var numSrcFiles = 0;
var gotSrcInfo = false;
var numPages = 0;

// default document sizes
var docWidth = 1024;
var docHeight = 512;

// pixel margin around each image
var docMargin = 0;

// datafile export
var exportFileName = 'sprite.css';
var lineTemplate = '.#filename { background-position: -#xpx -#ypx; height: #heightpx; width: #widthpx;}';

//----------------------------------------------------------------------------
// looks like ps javascript has no filter function...
//----------------------------------------------------------------------------
if (!Array.prototype.filter) {
  Array.prototype.filter = function (fun) {
    var len = this.length;
    if (typeof fun !== 'function')
      throw new TypeError();

    var res = [];
    var thisp = arguments[1];
    for (var i = 0; i < len; i++) {
      if (i in this) {
        var val = this[i]; // in case fun mutates this
        if (fun.call(thisp, val, i, this))
          res.push(val);
      }
    }
    return res;
  };
}

//----------------------------------------------------------------------------
// ImageInfo - stores information for each source image
//----------------------------------------------------------------------------
function ImageInfo(file, width, height) {
	this.file = file;
	this.path = path;
	this.width = width;
	this.height = height;
	this.posX = NaN;
	this.posY = NaN;
	this.hasAtlasPosition = false;
	this.pageNum = 0;
}
var sourceFiles=[];

//----------------------------------------------------------------------------
// set up gui
//----------------------------------------------------------------------------
var myDialog = new Window('dialog', 'Atlas Css v' + Version);
myDialog.alignChildren = 'fill';

myDialog.srcDirPanel = myDialog.add('panel', undefined, 'Source Directory');
myDialog.srcDirPanel.getDirGrp = myDialog.srcDirPanel.add('group');
myDialog.srcDirPanel.getDirGrp.orientation = 'row';
myDialog.srcDirPanel.getDirGrp.srcDirTxt = myDialog.srcDirPanel.getDirGrp.add('edittext', undefined, '');

myDialog.srcDirPanel.getDirGrp.srcDirTxt.preferredSize = [300, 25];
myDialog.srcDirPanel.getDirGrp.srcDirTxt.onChange = onSrcDirTxtChange;

myDialog.srcDirPanel.getDirGrp.srcDirBtn = myDialog.srcDirPanel.getDirGrp.add('button', undefined, 'Browse...');
myDialog.srcDirPanel.getDirGrp.srcDirBtn.onClick = onSrcDirBtnClick;

myDialog.srcDirPanel.srcInfoGrp = myDialog.srcDirPanel.add('group');
myDialog.srcDirPanel.srcInfoGrp.orientation = 'column';
myDialog.srcDirPanel.srcInfoGrp.alignment = 'left';
myDialog.srcDirPanel.srcInfoGrp.numFilesTxt = myDialog.srcDirPanel.srcInfoGrp.add('statictext', undefined, 'Number of Files:');
myDialog.srcDirPanel.srcInfoGrp.numFilesTxt.preferredSize = [200, 20];

//----------------------------------------------------------------------------
// document panel
//----------------------------------------------------------------------------
myDialog.docPanel = myDialog.add('panel', undefined, 'Document');
myDialog.docPanel.orientation = 'row';

myDialog.docPanel.docSizeGrp = myDialog.docPanel.add('group');
myDialog.docPanel.docSizeGrp.orientation = 'column';
myDialog.docPanel.docSizeGrp.alignment = 'left';

myDialog.docPanel.docSizeGrp.widthGrp = myDialog.docPanel.docSizeGrp.add('group');
myDialog.docPanel.docSizeGrp.widthGrp.orientation = 'row';
myDialog.docPanel.docSizeGrp.widthGrp.alignment = 'right';
myDialog.docPanel.docSizeGrp.widthGrp.docWidthTxt = myDialog.docPanel.docSizeGrp.widthGrp.add('statictext', undefined, 'Width:');
myDialog.docPanel.docSizeGrp.widthGrp.widthEdit = myDialog.docPanel.docSizeGrp.widthGrp.add('edittext', undefined, docWidth);
myDialog.docPanel.docSizeGrp.widthGrp.widthEdit.preferredSize = [50, 25];
myDialog.docPanel.docSizeGrp.widthGrp.widthEdit.onChange = onDocDimensionsChange;

myDialog.docPanel.docSizeGrp.heightGrp = myDialog.docPanel.docSizeGrp.add('group');
myDialog.docPanel.docSizeGrp.heightGrp.orientation = 'row';
myDialog.docPanel.docSizeGrp.heightGrp.alignment = 'right';
myDialog.docPanel.docSizeGrp.heightGrp.docWidthTxt = myDialog.docPanel.docSizeGrp.heightGrp.add('statictext', undefined, 'Height:');
myDialog.docPanel.docSizeGrp.heightGrp.heightEdit = myDialog.docPanel.docSizeGrp.heightGrp.add('edittext', undefined, docHeight);
myDialog.docPanel.docSizeGrp.heightGrp.heightEdit.preferredSize = [50, 25];
myDialog.docPanel.docSizeGrp.heightGrp.heightEdit.onChange = onDocDimensionsChange;

myDialog.docPanel.docSizeGrp.marginGrp = myDialog.docPanel.docSizeGrp.add('group');
myDialog.docPanel.docSizeGrp.marginGrp.orientation = 'row';
myDialog.docPanel.docSizeGrp.marginGrp.alignment = 'right';
myDialog.docPanel.docSizeGrp.marginGrp.marginTxt = myDialog.docPanel.docSizeGrp.marginGrp.add('statictext', undefined, 'Margin:');
myDialog.docPanel.docSizeGrp.marginGrp.marginEdit = myDialog.docPanel.docSizeGrp.marginGrp.add('edittext', undefined, docMargin);
myDialog.docPanel.docSizeGrp.marginGrp.marginEdit.preferredSize = [50, 25];
myDialog.docPanel.docSizeGrp.marginGrp.marginEdit.onChange = onDocDimensionsChange;

myDialog.docPanel.docInfoGrp = myDialog.docPanel.add('group');
myDialog.docPanel.docInfoGrp.orientation = 'column';
myDialog.docPanel.docInfoGrp.alignment = 'left';
myDialog.docPanel.docInfoGrp.rowcolGrp = myDialog.docPanel.docInfoGrp.add('group');
myDialog.docPanel.docInfoGrp.rowcolGrp.orientation = 'column';

myDialog.docPanel.docInfoGrp.pageGrp = myDialog.docPanel.add('group');
myDialog.docPanel.docInfoGrp.pageGrp.orientation = 'column';
myDialog.docPanel.docInfoGrp.pageGrp.alignment = 'left';
myDialog.docPanel.docInfoGrp.pageGrp.pagesTxt  = myDialog.docPanel.docInfoGrp.pageGrp.add('statictext', undefined, 'Pages Needed:');
myDialog.docPanel.docInfoGrp.pageGrp.pagesTxt.preferredSize = [200, 20];

//----------------------------------------------------------------------------
// datafile export
//----------------------------------------------------------------------------
myDialog.dataPanel = myDialog.add('panel', undefined, 'Datafile Export');
myDialog.dataPanel.checkbxGrp = myDialog.dataPanel.add('group');
myDialog.dataPanel.checkbxGrp.orientation = 'row';
myDialog.dataPanel.checkbxGrp.alignment= 'left';
myDialog.dataPanel.checkbxGrp.dataStrCheck = myDialog.dataPanel.checkbxGrp.add('checkbox', undefined, 'Enable datafile export');
myDialog.dataPanel.checkbxGrp.dataStrCheck.onClick = function () {
	myDialog.dataPanel.dataStrGrp.dataStr.enabled = myDialog.dataPanel.checkbxGrp.dataStrCheck.value;
};
myDialog.dataPanel.checkbxGrp.dataStrCheck.value = false;

myDialog.dataPanel.dataStrGrp = myDialog.dataPanel.add('group');
myDialog.dataPanel.dataStrGrp.orientation = 'column';
myDialog.dataPanel.dataStrGrp.alignment= 'left';
myDialog.dataPanel.dataStrGrp.dataStrTxt = myDialog.dataPanel.dataStrGrp.add('statictext', undefined, 'line template for each image');
myDialog.dataPanel.dataStrGrp.dataStrTxt.alignment = 'left';
myDialog.dataPanel.dataStrGrp.dataStr = myDialog.dataPanel.dataStrGrp.add('edittext', undefined, lineTemplate);
myDialog.dataPanel.dataStrGrp.dataStr.preferredSize = [390, 25];
myDialog.dataPanel.dataStrGrp.dataStr.enabled = false;
myDialog.dataPanel.dataStrGrp.dataStr.onChange = onDataStrChange;

//----------------------------------------------------------------------------
// system buttons
//----------------------------------------------------------------------------
myDialog.systemGrp = myDialog.add('group');
myDialog.systemGrp.orientation = 'row';
myDialog.systemGrp.alignment= 'right';

myDialog.systemGrp.aboutButton = myDialog.systemGrp.add('button', undefined, 'About');
myDialog.systemGrp.aboutButton.onClick = onAboutButtonClick;

myDialog.systemGrp.okButton = myDialog.systemGrp.add('button', undefined, 'Ok');
myDialog.systemGrp.okButton.onClick = onOkButtonClick;
myDialog.systemGrp.okButton.alignment= 'right';

myDialog.systemGrp.cancelButton = myDialog.systemGrp.add('button', undefined, 'Cancel');
myDialog.systemGrp.cancelButton.onClick = function () {
	close();
};
myDialog.systemGrp.okButton.alignment = 'right';

//----------------------------------------------------------------------------
// display dialog, do stuff, then close
//----------------------------------------------------------------------------
myDialog.center();
myDialog.show();

close();

function close() {
 	preferences.rulerUnits = defaultRulerUnits;
	myDialog.close();
}

//----------------------------------------------------------------------------
// ProcessSrcDirectory() -
//----------------------------------------------------------------------------
function ProcessSrcDirectory() {
	//rjd: this prevents the script from dying with files ps doesnt
	// recognise. Add your own filetype if it aint here
	var files = srcFolder.getFiles(/\.(jpg|tif|psd|png|gif|bmp)$/i);

	if (!files || files.length === 0) {
		return false;
	}

	sourceFiles = [];

	//rjd: TODO: put up some kind of notice/progress bar here...
	// get size info from source files and store it for later.
	for (var i = 0; i < files.length; i++) {
		if (files[i] instanceof File) {
			var doc = open(files[i]);
			if(doc !== null) {
				//rjd: the doc sizes are of the form "n px". We need to change em to plain old int
				//or the rectanglepacker will die
				var widthStr = doc.width.toString();
				var heightStr= doc.height.toString();

				widthStr = widthStr.substring(0, widthStr.indexOf(" px"));
				heightStr = heightStr.substring(0, heightStr.indexOf(" px"));

				var width = parseInt(widthStr);
				var height= parseInt(heightStr);

				sourceFiles[sourceFiles.length] = new ImageInfo(files[i], width, height);
				doc.close(SaveOptions.DONOTSAVECHANGES);
				numSrcFiles++;
			}
		}
	}
	myDialog.srcDirPanel.srcInfoGrp.numFilesTxt.text = 'Number of Files: ' + numSrcFiles;
	return true;
}

//----------------------------------------------------------------------------
// onSrcDirBtnClick
//----------------------------------------------------------------------------
function onSrcDirBtnClick() {
	srcFolder = Folder.selectDialog('Select Src Directory');
	if(srcFolder !== null) {
		myDialog.srcDirPanel.getDirGrp.srcDirTxt.text = srcFolder.fsName;
		gotSrcInfo = ProcessSrcDirectory();
		onDocDimensionsChange();
	}
}

//----------------------------------------------------------------------------
// onSrcDirTxtChange
//----------------------------------------------------------------------------
function onSrcDirTxtChange() {
	//alert ("changing text");
	// make sure its a valid directory
}

//----------------------------------------------------------------------------
// onDocDimensionsChange
//----------------------------------------------------------------------------
function onDocDimensionsChange()
{
	var width = myDialog.docPanel.docSizeGrp.widthGrp.widthEdit.text;
	var height= myDialog.docPanel.docSizeGrp.heightGrp.heightEdit.text;
	var margin= myDialog.docPanel.docSizeGrp.marginGrp.marginEdit.text;

	//validate dimensions
	if (!/^-?\d+$/.test(width)) {
		alert('invalid width');
	 	return;
	}

	if (!/^-?\d+$/.test(height)) {
	 	alert('invalid width');
	 	return;
	}

	if (!/^-?\d+$/.test(margin)) {
	 	alert('invalid width');
	 	return;
	}

	docWidth = parseInt(width);
	docHeight = parseInt(height);
	docMargin = parseInt(margin);

	if (gotSrcInfo) {
		myDialog.docPanel.docInfoGrp.pageGrp.pagesTxt.text = 'CALCULATING ATLAS...';

		ResetImages();
		var imagesLeftToFit = sourceFiles.length;
		var page = 0;
		while (imagesLeftToFit > 0) {
			imagesLeftToFit = CalcAtlas(page++);
		}
		//TestPrint();
		myDialog.docPanel.docInfoGrp.pageGrp.pagesTxt.text = 'Pages needed: ' + page;
		numPages = page;
	}
}

//----------------------------------------------------------------------------
// CalcAtlas()
//----------------------------------------------------------------------------
function CalcAtlas(currentPage) {
	var nofit = 0;
	var packer = new NETXUS.RectanglePacker(docWidth, docHeight);

	for (var i = 0; i < sourceFiles.length; i++) {
		var coords;
		var sourceImage = sourceFiles[i];

		if (!sourceImage.hasAtlasPosition) {
			// find out where to put the image...
			coords = packer.findCoords(sourceImage.width + docMargin, sourceImage.height + docMargin);
			if (coords) {
				sourceImage.posX = coords.x;
				sourceImage.posY = coords.y;
				sourceImage.hasAtlasPosition = true;
				sourceImage.page = currentPage;
			} else {
				nofit++;
			}
		}
	}
	return nofit;
}

//----------------------------------------------------------------------------
// ResetImages - clear position+page info from our images
//----------------------------------------------------------------------------
function ResetImages() {
	for(var i = 0; i < sourceFiles.length; i++) {
		sourceFiles[i].posX = NaN;
		sourceFiles[i].posY = NaN;
		sourceFiles[i].hasAtlasPosition = false;
		sourceFiles[i].page = 0;
	}
}

//----------------------------------------------------------------------------
// onOkButtonClick
//----------------------------------------------------------------------------
function onOkButtonClick() {
	if (gotSrcInfo) {
		MakeAtlasSheets();
		if (myDialog.dataPanel.checkbxGrp.dataStrCheck.value)
			createExportFile();
		close();
	} else
		alert('Please select a valid source directory');
}

//----------------------------------------------------------------------------
// MakeAtlasSheets
//----------------------------------------------------------------------------
function MakeAtlasSheets() {
	for (var i = 0; i < numPages; i++) {
		// use filter to get images that belong on the current page
		var sourceImgs = sourceFiles.filter(function (x) {
			if (x.page === i)
				return true;
		});
		var currentPage = documents.add(docWidth, docHeight, 72.0, 'AtlasSheet#' + i, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
		for(var j = 0; j < sourceImgs.length; j++) {
			var imgInfo = sourceImgs[j];
			var srcImg  = open(imgInfo.file);

			app.activeDocument = srcImg;

			//rjd: this try block checks for empty frames.
			//make sure to check "dont break on exceptions" in debug menu of extendscript toolkit
			var ignoreFlag = false;
			try {
				srcImg.selection.selectAll();
				srcImg.selection.copy();
			} catch(e) {
				ignoreFlag = true;
			}
			if (!ignoreFlag) {
				// paste the sprite in the new page, then move it
				app.activeDocument = currentPage;
				var layerRef = currentPage.paste();

				// rjd: if the image contains empty pixels, photoshop will not select them
				// and the selection will be smaller than the src image.
				// if this happens, we fix it here...
				var srcWidth = ConvertPxToInt(srcImg.width);
				var srcHeight= ConvertPxToInt(srcImg.height);

				var destWidth = layerRef.bounds[2] - layerRef.bounds[0];
				var destHeight = layerRef.bounds[3] - layerRef.bounds[1];

				var nudgeX = 0;
				var nudgeY = 0;

				if(destWidth < srcWidth)
					nudgeX = (srcWidth - destWidth) / 2;

				if(destHeight < srcHeight)
					nudgeY = (srcHeight - destHeight) / 2;

				// translate to origin,then to new position
				layerRef.translate(-layerRef.bounds[0], -layerRef.bounds[1]);
				layerRef.translate(imgInfo.posX + Math.ceil(Math.abs(nudgeX)), imgInfo.posY + Math.ceil(Math.abs(nudgeY)));
			}
			srcImg.close(SaveOptions.DONOTSAVECHANGES);
		}
	}
}

//----------------------------------------------------------------------------
// createExportFile()
//----------------------------------------------------------------------------
function createExportFile() {
	// create export file in src dir
	var exportFile = new File(srcFolder.absoluteURI + '/' + exportFileName);
	exportFile.open('w');

	for(var i = 0; i < sourceFiles.length; i++) {
		var a = sourceFiles[i];

		var posx = a.posX + docMargin;
		var posy = a.posY + docMargin;
		posx = posx.toString();
		posy = posy.toString();

		var width= a.width.toString();
		var height= a.height.toString();
		var page = a.page;

		var exportLine = myDialog.dataPanel.dataStrGrp.dataStr.text;
		exportLine = exportLine.replace(/#filename/, a.file.name.replace(/\..*$/, ''));
		exportLine = exportLine.replace(/#i/, i);
		exportLine = exportLine.replace(/#x/, posx);
		exportLine = exportLine.replace(/#y/, posy);
		exportLine = exportLine.replace(/#width/, width);
		exportLine = exportLine.replace(/#height/, height);
		exportLine = exportLine.replace(/#p/, page);
		exportFile.writeln(exportLine);
	}
	exportFile.close();
}

//----------------------------------------------------------------------------
// onDataStrChange
//----------------------------------------------------------------------------
function onDataStrChange() {
	//rjd: do we need to perform validation on anything here?
}

//----------------------------------------------------------------------------
// onAboutButtonClick
//----------------------------------------------------------------------------
function onAboutButtonClick() {
	var aboutWin = new Window('dialog', 'About AtlasMaker');
	aboutWin.preferredSize = [300, 400];
	aboutWin.location = {
		x: 200,
		y: 150
	};
	var aboutText = 'Atlas Maker v' + Version;

	aboutWin.aboutTxt = aboutWin.add('statictext', undefined, aboutText, { multiline: true, scrolling: true});

	aboutWin.okButton = aboutWin.add('button', undefined, 'Ok');
	aboutWin.okButton.onClick = function () {
		aboutWin.close();
	};
	aboutWin.okButton.alignment = 'center';

	aboutWin.show();
}

//----------------------------------------------------------------------------
// ConvertPxToInt() - photoshop often returns sizes as " nn px". this
// function turns them into plain old int
//----------------------------------------------------------------------------
function ConvertPxToInt(input) {
	var inpStr = input.toString();
	inpStr = inpStr.substring(0, inpStr.indexOf(' px'));
	return parseInt(inpStr);
}
/*
 * The main Jandoc procedure.
 */

var fs = require('fs-extra'),
    exec = require('child_process').exec,
    bashArgs,
    args;
 
/*
 * Test if a path is a directory.
 */
function isDir(path) {
  try {
    fs.readdirSync(path);
    return true;
  } catch (e) {
    return false;
  }
}

/*
 * Checks if a file has an extension.
 */
function hasFileExtension(path) {
  return /\.[^\/]+$/.test(path);
}

/*
 * Returns a file's extension.
 */
function getFileExtension(path) {
  return path.match(/\.[^\/]+$/)[0].slice(1);
}

/*
 * Removes the extension from a file name.
 */
function stripFileExtension(path) {
  return path.replace(/\.[^\/]+$/, '');
}

/*
 * Separates out a pure file name from a path.
 */
function getFileName(path) {
  return path.match(/\/?[^\/]+$/)[0].replace(/^\//, '');
}

/*
 * Removes -d and -o from bash args and returns the rest of the Pandoc options.
 */
function getPandocOptions(bashArgs) {
  return bashArgs.join(' ').replace(/(^|\s*)(\-o|\-\-output\-location)\s+[^\s]+/g, '')
                           .replace(/(^|\s*)(\-d|\-\-input\-data)\s+[^\s]+/g, '');
}

/*
 * Determine what the output file type should be after conversion.
 */
function getOutputFormat(formatVar, outputVar) {
  if (formatVar) {
    formatVar = formatVar[0];
  }
  if (outputVar) {
    outputVar = outputVar[0];
  }
  
  /*
   * If the user specified it, return that.
   */
  if (formatVar) {
    
    // adjust html5 > html
    if (formatVar === 'html5') {
      formatVar = 'html';
    }
    
    return formatVar;
  }
  
  /*
   * If the user didn't specify and the output is a folder, error.
   * If the output is a file with no extension, error.
   */
  if (isDir(outputVar) || !hasFileExtension(outputVar)) {
    console.error('No output filetype specified.');
    process.exit(1);
  }
  
  /*
   * If the output is a file with an extension, return the
   * extension.
   */
  return getFileExtension(outputVar);
}

/*
 * If Pandoc gives us an error warning, pass it on
 * to the user. *Only called by synchronous API!*
 */
function catchWarningSync(err, stdout, stderr) {
  if (stdout) {
    console.log(stdout.replace(/^pandoc:\s/, 'jandoc: ').replace(/\n*$/, ''));
  }

  if (stderr) {
    console.log(stderr.replace(/^pandoc:\s/, 'jandoc: ').replace(/\n*$/, '\njandoc: conversion was NOT successful.'));
  }

  if (err) {
    process.exit(1);
  }
}

/*
 * Builds a Pandoc command line command.
 */
function buildCommand(inputFile, outputFile, outputFormat, argString) {
  // var res =  'pandoc ' + inputFile + ' -o ' + stripFileExtension(outputFile) + '.' + outputFormat + ' ' + argString;
  var res =  'pandoc ' + inputFile + ' -o ' + outputFile + ' ' + argString;
//   console.log(res);
  return res;
}

function decideRunCommand(inputPath, outputPath, outputFormat, argString, callback) {
  var files, command, i,
  
      /*
       * Sync/Async API
       * The handler has to be be declared here in order to have acces to the `callback`.
       */
      execHandler = function (err, stdout, stderr) {
                      
        /*
         * If we've got a callback, use it.
         */
        if (callback) {
          
          var answer = {},
              error;
          
          ["stderr", "stdout"].forEach(function (thing) {
            if (thing) {
              answer[thing] = thing;
            }
          });

          if (err) {
            error = new Error(stderr);
          }
          
          return callback(error || null, answer);

         } 
         else {
           
          /*
           * If there is no callback, we return normally with a return value.
           */
         
          return catchWarningSync(err || null, stdout || null, stderr || null);

        }
      
      };
  
  /*
   * If the input path is a directory...
   */
  if (isDir(inputPath)) {
    
    /*
     * Get a list of files in the directory and loop over them.
     */
    files = fs.readdirSync(inputPath);
    for (i = 0; i < files.length; i += 1) {
      
      /*
       * For now, don't recurse into sub directories so
       * if the current file is not a directory...
       */
      if (!isDir(inputPath + '/' + files[i])) {
        
        /*
         * If the output path is intended to be a directory...
         */
        if (!hasFileExtension(outputPath)) {
          
          /*
           * If the output directory doesn't exist yet, create it.
           */
          if (!isDir(outputPath)) {
            fs.mkdirpSync(outputPath);
          }
          
          /*
           * Build the command and run it.
           */
          command = buildCommand(inputPath + '/' + files[i], outputPath + '/' + files[i], outputFormat, argString);
          exec(command, execHandler);
          
        /*
         * Otherwise, the input is a file and the output is a file.
         * Build the command and run it.
         */
        } else {
          command = buildCommand(inputPath + '/' + files[i], outputPath, outputFormat, argString);
          
          exec(command, execHandler);

        }
      }
    }
  
  /*
   * If the input path is a file...
   */
  } else {
    
    /*
     * If the output is intended to be a directory...
     */
    if (!hasFileExtension(outputPath)) {
      
      /*
       * If the output directory doesn't exist yet, create it.
       */
      if (!isDir(outputPath)) {
        fs.mkdirpSync(outputPath);
      }
      
      /*
       * Build the command and run it.
       */
      command = buildCommand(inputPath, outputPath + '/' + getFileName(inputPath), outputFormat, argString);
      exec(command, execHandler);
    
    /*
     * Otherwise, the input is a file and the output is a file.
     * Build the command and run it.
     */
    } else {
      command = buildCommand(inputPath, outputPath, outputFormat, argString);
      exec(command, execHandler);
    }
  }
}

/*
 * What to do when we have our arguments and are ready to go.
 */
function procedure(bashArgs, args, callback) {
  var argString    = getPandocOptions(bashArgs),
      inputPath    = args['-d'][0],
      outputFormat = getOutputFormat(args['-t'], args['-o']),
      res;
  
  
  if (callback) {
    return decideRunCommand(inputPath, args['-o'][0], outputFormat, argString, callback);
  }
  else {
    res = decideRunCommand(inputPath, args['-o'][0], outputFormat, argString);
    return res;
  }
  
}

module.exports = procedure;

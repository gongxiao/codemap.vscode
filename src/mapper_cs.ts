import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from "net";
import * as mkdirp from "mkdirp";
import * as process from "process";
import * as child_process from "child_process"
import { Uri, commands } from "vscode";
import { Utils } from './utils';

let exec = require('child_process').exec;
let map = "";
let map_last_source = "";

let SYNTAXER_VERSION = "1.2.1.0";

let SEVER = ""; // will be set at the end of this file
let HOST = '127.0.0.1';
let PORT = 18002;

function startServer():void{
	child_process.execFile("mono", [SEVER, "-port:" + PORT, "-listen", "-client:" + process.pid, "-timeout:60000"]);
}

export class mapper {

	public static generate(file: string): string[] {

		var stats = fs.statSync(file);
		var map_source = file + stats.mtime;

		if (map_source != map_last_source) {
			map_last_source = map_source;
			map = "";
		}

		// 18000 - Subline Text 3
		// 18001 - Notepad++
		// 18002 - VSCode.CodeMap

		if (map == "") {
			var client = new net.Socket();
			client.connect(PORT, HOST, function () {
				let request = "-client:" + process.pid + "\n-op:codemap_vscode\n-script:" + file;
				client.write(request);
			});

			client.on('error', function (error) {
				if (fs.existsSync(SEVER)) { // may not be deployed yet
					// child_process.execFile(SEVER, SEVER_CMD);
					startServer();
					setTimeout(() => vscode.commands.executeCommand('codemap.refresh'), 500);
				}
				else
					setTimeout(() => vscode.commands.executeCommand('codemap.refresh'), 3000);
			});

			client.on('data', function (data) {
				map = data.toString()
				// https://github.com/oleg-shilo/codemap.vscode/wiki/Adding-custom-mappers
				// [indent]<name>|<line>|<icon>
				vscode.commands.executeCommand('codemap.refresh')
				client.destroy();
			});
		}
		return map.lines();
	}
}

function DeploySyntaxer() {

	function create_dir(dir: string): void {
		// fs.mkdirSync can only create the top level dir but mkdirp creates all child sub-dirs that do not exist
		const allRWEPermissions = parseInt("0777", 8);
		mkdirp.sync(dir, allRWEPermissions);
	}

	function user_dir(): string {
		// ext_context.storagePath cannot be used as it is undefined if no workspace loaded

		// vscode:
		// Windows %appdata%\Code\User\settings.json
		// Mac $HOME/Library/Application Support/Code/User/settings.json
		// Linux $HOME/.config/Code/User/settings.json

		if (os.platform() == 'win32') {
			return path.join(process.env.APPDATA, 'Code', 'User', 'codemap.user');
		}
		else if (os.platform() == 'darwin') {
			return path.join(process.env.HOME, 'Library', 'Application Support', 'Code', 'User', 'codemap.user');
		}
		else {
			return path.join(process.env.HOME, '.config', 'Code', 'User', 'codemap.user');
		}
	}

	const fse = require('fs-extra')

	let fileName = "syntaxer.exe";
	let ext_dir = path.join(__dirname, "..", "..");
	let sourceDir = path.join(ext_dir, 'bin');
	let destDir = path.join(user_dir(), 'syntaxer', SYNTAXER_VERSION);
	// let destDir = path.join(user_dir(), '..', 'cs-script.common', 'syntaxer', SYNTAXER_VERSION);

	SEVER = path.join(destDir, fileName);

	if (fs.existsSync(SEVER)) {
		startServer();
	}
	else {
		create_dir(destDir);

		fse.copy(path.join(sourceDir, fileName), path.join(destDir, fileName))
			.then(() => {
				startServer();
			})
			.catch(err => {
				console.error(err);
			})
	}
}

DeploySyntaxer();
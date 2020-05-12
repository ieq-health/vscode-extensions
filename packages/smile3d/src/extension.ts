import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const contenttree = [
		{ detail: 'einzelimplantat', label: 'Einzelimplantat' },
		{ detail: 'implantatgetragene-bruecke', label: 'Implantatgetragene Brücke' },
		{ detail: 'herausnehmbare-vollprothese', label: 'Vollprothese herausnehmbar' },
		{ detail: 'festsitzende-vollprothese', label: 'Vollprothese festsitzend' },
		{ detail: 'geschiebeprothese', label: 'Geschiebeprothese' },
		{ detail: 'verlust-einzelzahn', label: 'Verlust Einzelzahn' },
		{ detail: 'navigierte-implantologie', label: 'Navigierte Implantologie' },
		{ detail: 'wurzelspitzenresektion', label: 'Wurzelspitzenresektion' },
		{ detail: 'wurzelkanalbehandlung', label: 'Wurzelkanalbehandlung' },
		{ detail: 'weisheitszahnentfernung', label: 'Weisheitszahnentfernung' },
		{ detail: 'inlay', label: 'Inlay' },
		{ detail: 'onlay-und-krone', label: 'Onlay und Krone' },
		{ detail: 'hochwertige-fuellungen', label: 'Hochwertige Füllungen' },
		{ detail: 'bruecken', label: 'Brücken' },
		{ detail: 'teleskopprothese', label: 'Teleskopprothese' },
		{ detail: 'knochenaufbau-sinuslift', label: 'Sinuslift' },
		{ detail: 'knochenaufbau-zahnverlust', label: 'Knochenaufbau Zahnverlust' },
		{ detail: 'knochenaufbau-rueckbildung', label: 'Knochenaufbau Rückbildung' },
		{ detail: 'knochenaufbau-um-implantate', label: 'Knochenaufbau um Implantate' },
		{ detail: 'professionelle-zahnreinigung', label: 'Professionelle Zahnreinigung' },
		{ detail: 'parodontitisbehandlung', label: 'Parodontitisbehandlung' },
		{ detail: 'bleaching', label: 'Bleaching' },
		{ detail: 'veneers', label: 'Veneers' },
		{ detail: 'adhaesivbruecke', label: 'Adhäsivbrücke' },
		{ detail: 'keramikimplantat-pure', label: 'Keramikimplantat' },
		{ detail: 'sofortversorgung-vollprothese', label: 'Sofortversorgung Vollprothese' }
	];

	const completions: vscode.QuickPickItem[] = contenttree;

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.insertcontent', () => {
		let editor = vscode.window.activeTextEditor;

		vscode.window.showQuickPick(completions).then(pick => {
			editor.edit(edit => {
				editor.selections.forEach(selection => {
					edit.insert(
						selection.start,
						`<IEQ-CMS function="InsertContent" param="content=/health/dental/mediathek/mediathek-isotope/${pick.detail};kurzfassung=ja"></IEQ-CMS>`
					);
				});
			});
		});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

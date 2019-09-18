import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const attributes = [
		'name',
		'strasse',
		'plzort',
		'plz',
		'ort',
		'nur_telefon',
		'telefon',
		'telefon_nolink',
		'mobil',
		'mobil_nolink',
		'nur_fax',
		'fax',
		'nur_e-mail',
		'e-mail',
		'e-mail_nolink',
		'homepage',
		'homepage_nolink',
		'homepage_http_nolink',
		'oeffnungszeiten',
		'leerzeichen',
		'leerzeile',
		'shopid',
		'liefergebiet',
		'geobreitengrad',
		'geolaengengrad',
		'regions',
		'regionl',
		'ortes',
		'ortel',
		'spezials',
		'spezialm',
		'speziall',
		'kontakt',
		'payoff',
		'slogan',
		'keywords',
		'keywordl',
		'titels',
		'titell',
		'beschreibungs',
		'beschreibungl',
		'zertifikats',
		'zertifikatl',
		'googleapikey',
		'bingmapskey',
		'traderid',
		'bundesland',
		'land',
		'verantwortlich'
	];

	async function showPickSeparator() {
		const result = await vscode.window.showQuickPick(['Leerzeichen','Umbruch'], { placeHolder: 'Trennzeichen' });
		return result;
	}


	let disposable = vscode.commands.registerCommand('firmendatenq.insertFirmendaten', () => {
		let editor = vscode.window.activeTextEditor;

		vscode.window.showQuickPick(attributes, { canPickMany: true }).then(async pick => {
			let separator = '';

			if (pick.indexOf(',') > 0) {
				separator = ';Trennzeichen=' + await showPickSeparator();
			}

			editor.edit(edit => {
				editor.selections.forEach(selection => {
					edit.insert(
						selection.start,
						`<IEQ-CMS function="InsertFirmendaten" param="Felder=${pick}${separator}">[Firmendaten: Name, Adresse + Telefonnummer]</IEQ-CMS>`
					)
				})
			})
		})
	})
}


// this method is called when your extension is deactivated
export function deactivate() {}

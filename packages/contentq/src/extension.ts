import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const contenttree = [
		// /health
		'/health',

		// /health/dental
		'/health/dental',

		// /health/dental/praxis
		'/health/dental/praxis',
		'/health/dental/praxis/technik',
		"/health/dental/praxis/technik/3d-navigation",
		"/health/dental/praxis/technik/3d-planung",
		"/health/dental/praxis/technik/abdruck-modellscanner",
		"/health/dental/praxis/technik/air-flow-master",
		"/health/dental/praxis/technik/air-flow-master-piezon",
		"/health/dental/praxis/technik/air-flow-technik",
		"/health/dental/praxis/technik/air-scaler",
		"/health/dental/praxis/technik/arcus-digma",
		"/health/dental/praxis/technik/backward_planning",
		"/health/dental/praxis/technik/cad-cam-zahnersatz",
		"/health/dental/praxis/technik/cadiax",
		"/health/dental/praxis/technik/cercon",
		"/health/dental/praxis/technik/cerec-3d",
		"/health/dental/praxis/technik/cerec-inlab",
		"/health/dental/praxis/technik/diagnocam",
		"/health/dental/praxis/technik/diagnodent",
		"/health/dental/praxis/technik/digitale_zahnfarbenbestimmung",
		"/health/dental/praxis/technik/digitale-volumentomographie",
		"/health/dental/praxis/technik/digitales-roentgen",
		"/health/dental/praxis/technik/dir-system",
		"/health/dental/praxis/technik/elektrisches-laengenmessgeraet",
		"/health/dental/praxis/technik/elektrotom",
		"/health/dental/praxis/technik/florida-probe",
		"/health/dental/praxis/technik/freecorder-blue-fox",
		"/health/dental/praxis/technik/hardlaser",
		"/health/dental/praxis/technik/hydrokolloid-abformungen",
		"/health/dental/praxis/technik/icon",
		"/health/dental/praxis/technik/intraorale-kamera",
		"/health/dental/praxis/technik/intraoralscanner",
		"/health/dental/praxis/technik/ipr",
		"/health/dental/praxis/technik/jeder-system",
		"/health/dental/praxis/technik/karies_indikator",
		"/health/dental/praxis/technik/kofferdam",
		"/health/dental/praxis/technik/laserbehandlung",
		"/health/dental/praxis/technik/lupenbrille",
		"/health/dental/praxis/technik/maschinelle-wurzelkanalbehandlung",
		"/health/dental/praxis/technik/op-mikroskop-allgemein",
		"/health/dental/praxis/technik/op-mikroskop-wurzelkanalbehandlung",
		"/health/dental/praxis/technik/oral-health-manager",
		"/health/dental/praxis/technik/ozonbehandlung",
		"/health/dental/praxis/technik/perio-marker",
		"/health/dental/praxis/technik/periochip",
		"/health/dental/praxis/technik/perioscan",
		"/health/dental/praxis/technik/periotest",
		"/health/dental/praxis/technik/photoaktivierte-oraldesinfektion",
		"/health/dental/praxis/technik/photodynamische-lasertherapie",
		"/health/dental/praxis/technik/photothermische-therapie",
		"/health/dental/praxis/technik/piezosurgery",
		"/health/dental/praxis/technik/piezotom",
		"/health/dental/praxis/technik/prognos-meridiandiagnostik",
		"/health/dental/praxis/technik/pulverstrahlgeraet",
		"/health/dental/praxis/technik/pulverstrahlgeraet-paro",
		"/health/dental/praxis/technik/siroinspect",
		"/health/dental/praxis/technik/softlaser",
		"/health/dental/praxis/technik/sonicweld-rx",
		"/health/dental/praxis/technik/sonosurgery",
		"/health/dental/praxis/technik/soprolife",
		"/health/dental/praxis/technik/spectroshade",
		"/health/dental/praxis/technik/the-wand",
		"/health/dental/praxis/technik/thermoplastische-fuellungen",
		"/health/dental/praxis/technik/trinkwasseraufbereitung",
		"/health/dental/praxis/technik/ultraschall-chirurgie",
		"/health/dental/praxis/technik/ultraschall-paro",
		"/health/dental/praxis/technik/ultraschallaktivierte-spuelloesungen",
		"/health/dental/praxis/technik/vistacam",
		"/health/dental/praxis/technik/zebris-jma-system",
	];

	const completions: vscode.QuickPickItem[] = [];

	contenttree.forEach((path: string) => {
		completions.push({
			label: path.split('/').pop(),
			detail: path
		});
	});

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
						`<IEQ-CMS function="InsertContent" param="content=${pick.detail};kurzfassung=nein">InsertContent Langfassung - ${pick.label}</IEQ-CMS>`
					);
				});
			});
		});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

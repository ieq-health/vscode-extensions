#!/usr/bin/env node
// Build tooling for every extension in packages/. Packages carry no scripts or
// build config of their own; everything goes through this file.
//
// Usage: node scripts/build.mjs <command> [package...]
//
//   check             validate manifests and type-check all packages
//   lint              run oxlint, oxfmt (check only), rumdl and yamlfmt (lint only)
//   test              run packages/*/test/**/*.test.ts with node --test
//   format            apply oxlint fixes, then oxfmt, rumdl and yamlfmt formatting
//   bundle [pkg...]   check, then bundle each code package to out/extension.js
//   watch  [pkg...]   rebundle on change (no type-checking; see `npm run watch`)
//   package [pkg...]  bundle, then build dist/<name>-<version>.vsix
//   release <tag>     package and publish the package named by a
//                     <package>-v<version> tag (needs VSCE_PAT)
//
// Without package names, commands apply to all packages.

import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { delimiter, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { createVSIX, publishVSIX } from "@vscode/vsce";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootManifest = readJson(join(root, "package.json"));

const PUBLISHER = "christianbrassat";
const LICENSE = "BSD-2-Clause";
const REPOSITORY = "https://github.com/ieq-health/vscode-extensions";
const BRANCH = "main";
const MAIN = "./out/extension.js";

/**
 * @typedef {object} Package
 * @property {string} name     directory name under packages/, equal to manifest name
 * @property {string} dir      absolute path
 * @property {any} manifest    parsed package.json
 * @property {boolean} code    true if it has an entry point to bundle
 */

/** @returns {Package[]} */
function allPackages() {
	const base = join(root, "packages");
	return readdirSync(base, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() &&
				existsSync(join(base, entry.name, "package.json")),
		)
		.map((entry) => {
			const dir = join(base, entry.name);
			const manifest = readJson(join(dir, "package.json"));
			return { name: entry.name, dir, manifest, code: "main" in manifest };
		});
}

/** @param {string[]} names */
function selectPackages(names) {
	const packages = allPackages();
	if (names.length === 0) {
		return packages;
	}
	return names.map((name) => {
		const pkg = packages.find((p) => p.name === name);
		if (!pkg) {
			fail(
				`Unknown package '${name}'. Available: ${packages.map((p) => p.name).join(", ")}`,
			);
		}
		return pkg;
	});
}

// Manifests are validated against the shared settings above and the root
// package.json, so drift fails CI instead of surfacing on the Marketplace.
function validateManifests() {
	const engine = rootManifest.engines?.vscode;
	const types = rootManifest.devDependencies?.["@types/vscode"];
	const errors = [];

	if (!engine || !types) {
		errors.push(
			'root package.json: engines.vscode and devDependencies["@types/vscode"] are required',
		);
	} else if (minVersion(types) !== minVersion(engine)) {
		errors.push(
			`root package.json: @types/vscode (${types}) must target the same VS Code version as engines.vscode (${engine})`,
		);
	}

	for (const { name, manifest: m, code } of allPackages()) {
		const where = `packages/${name}/package.json`;
		const expect = (ok, message) => ok || errors.push(`${where}: ${message}`);

		expect(m.name === name, `name must be "${name}" (the directory name)`);
		expect(m.publisher === PUBLISHER, `publisher must be "${PUBLISHER}"`);
		expect(m.license === LICENSE, `license must be "${LICENSE}"`);
		expect(
			m.engines?.vscode === engine,
			`engines.vscode must be "${engine}" (root package.json)`,
		);
		expect(
			m.repository?.url === `${REPOSITORY}.git` &&
				m.repository?.directory === `packages/${name}`,
			`repository must be { "type": "git", "url": "${REPOSITORY}.git", "directory": "packages/${name}" }`,
		);
		expect(
			!m.scripts,
			"must not define scripts; builds go through scripts/build.mjs",
		);
		expect(
			!m.devDependencies,
			"must not define devDependencies; add them to the root package.json",
		);
		if (code) {
			expect(m.main === MAIN, `main must be "${MAIN}"`);
			expect(
				existsSync(join(root, "packages", name, "src", "extension.ts")),
				"entry point src/extension.ts is missing",
			);
		}
	}

	// launch.json cannot glob, so check that it lists every package
	const names = allPackages()
		.map((p) => p.name)
		.sort()
		.join(", ");
	const launch = JSON.parse(
		readFileSync(join(root, ".vscode", "launch.json"), "utf8").replace(
			/^\s*\/\/.*$/gm,
			"",
		),
	);
	const picker = launch.inputs.find((input) => input.id === "package").options;
	const runAll = launch.configurations
		.find((c) => c.name === "Run All Extensions")
		.args.map((arg) =>
			arg.replace(
				/^--extensionDevelopmentPath=\$\{workspaceFolder\}\/packages\//,
				"",
			),
		);
	for (const [label, listed] of [
		['"package" input options', picker],
		['"Run All Extensions" args', runAll],
	]) {
		if ([...listed].sort().join(", ") !== names) {
			errors.push(`.vscode/launch.json: ${label} must list exactly: ${names}`);
		}
	}

	if (errors.length > 0) {
		fail(`Manifest check failed:\n  ${errors.join("\n  ")}`);
	}
}

function typecheck() {
	const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
	const result = spawnSync(process.execPath, [tsc, "--noEmit", "-p", root], {
		stdio: "inherit",
	});
	if (result.status !== 0) {
		fail("Type check failed");
	}
}

/**
 * Runs a CLI shipped as a Node script in node_modules.
 * @param {string} script path below node_modules, e.g. oxlint/bin/oxlint
 * @param {string[]} args
 */
function runNodeTool(script, args) {
	return (
		spawnSync(process.execPath, [join(root, "node_modules", script), ...args], {
			cwd: root,
			stdio: "inherit",
		}).status === 0
	);
}

/**
 * Finds a native executable: node_modules/.bin first (if the tool is an npm
 * dependency), then PATH. rumdl's npm binary is linked against glibc, which
 * NixOS cannot run without nix-ld; yamlfmt is not on npm at all.
 * @param {string} name
 * @param {string} hint how to install it when missing
 */
function nativeTool(name, hint) {
	const onPath = (process.env.PATH ?? "")
		.split(delimiter)
		.filter((dir) => dir && !dir.includes("node_modules"))
		.map((dir) => join(dir, name));
	for (const bin of [join(root, "node_modules", ".bin", name), ...onPath]) {
		if (
			existsSync(bin) &&
			spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0
		) {
			return bin;
		}
	}
	fail(`${name} cannot run. ${hint}`);
}

/** @param {string} bin @param {string[]} args */
function runNative(bin, args) {
	return spawnSync(bin, args, { cwd: root, stdio: "inherit" }).status === 0;
}

const rumdl = () =>
	nativeTool(
		"rumdl",
		"On NixOS, use `nix shell nixpkgs#rumdl` or enable programs.nix-ld.",
	);
const yamlfmt = () =>
	nativeTool(
		"yamlfmt",
		"Install it from https://github.com/google/yamlfmt (or `nix shell nixpkgs#yamlfmt`).",
	);

function lint() {
	const failed = [
		["oxlint", () => runNodeTool("oxlint/bin/oxlint", [])],
		["oxfmt", () => runNodeTool("oxfmt/bin/oxfmt", ["--check"])],
		["rumdl", () => runNative(rumdl(), ["check", "."])],
		["yamlfmt", () => runNative(yamlfmt(), ["-lint", "."])],
	]
		.filter(([, run]) => !run())
		.map(([name]) => name);
	if (failed.length > 0) {
		fail(
			`Lint failed: ${failed.join(", ")}. Run \`npm run format\` to fix what can be fixed automatically.`,
		);
	}
}

// Same order as the editor: oxlint fixes first, then oxfmt formats the result
function format() {
	runNodeTool("oxlint/bin/oxlint", ["--fix"]);
	runNodeTool("oxfmt/bin/oxfmt", ["--write"]);
	runNative(rumdl(), ["fmt", "."]);
	runNative(yamlfmt(), ["."]);
}

function check() {
	validateManifests();
	typecheck();
}

// Node's test runner with type stripping: no bundling, no extra dependency.
// Test files import sources with a .ts extension and run from the root.
function test() {
	const result = spawnSync(
		process.execPath,
		[
			"--experimental-strip-types",
			"--no-warnings=ExperimentalWarning",
			"--test",
			"packages/*/test/**/*.test.ts",
		],
		{ cwd: root, stdio: "inherit" },
	);
	if (result.status !== 0) {
		fail("Tests failed");
	}
}

/** @param {Package} pkg */
function esbuildOptions(pkg) {
	return {
		entryPoints: [join(pkg.dir, "src", "extension.ts")],
		outfile: join(pkg.dir, MAIN),
		bundle: true,
		external: ["vscode"],
		format: "cjs",
		platform: "node",
		target: "node18", // Node.js of VS Code 1.82 (engines.vscode)
		sourcemap: "linked",
		logLevel: "silent",
	};
}

/** @param {Package[]} packages */
async function bundle(packages) {
	check();
	for (const pkg of packages.filter((p) => p.code)) {
		const result = await esbuild
			.build(esbuildOptions(pkg))
			.catch((error) => error);
		report(result);
		if (result.errors.length > 0) {
			fail(`Bundling ${pkg.name} failed`);
		}
		console.log(`bundled ${pkg.name}`);
	}
}

// Prints "[watch] build started/finished" markers and file:line:col messages
// for the problem matcher in .vscode/tasks.json. Markers wrap all rebuilds
// in flight, so the matcher never sees a package finish while another builds.
/** @param {Package[]} packages */
async function watch(packages) {
	let building = 0;
	for (const pkg of packages.filter((p) => p.code)) {
		const context = await esbuild.context({
			...esbuildOptions(pkg),
			plugins: [
				{
					name: "watch-markers",
					setup(build) {
						build.onStart(() => {
							if (building++ === 0) {
								console.log("[watch] build started");
							}
						});
						build.onEnd((result) => {
							report(result);
							console.log(`rebuilt ${pkg.name}`);
							if (--building === 0) {
								console.log("[watch] build finished");
							}
						});
					},
				},
			],
		});
		await context.watch();
	}
}

/** @param {{ errors: esbuild.Message[], warnings: esbuild.Message[] }} result */
function report(result) {
	for (const [severity, messages] of [
		["error", result.errors],
		["warning", result.warnings],
	]) {
		for (const { text, location } of messages ?? []) {
			const where = location
				? `${relative(root, join(root, location.file))}:${location.line}:${location.column + 1}: `
				: "";
			console.error(`${where}${severity}: ${text}`);
		}
	}
}

/** @param {Package[]} packages */
async function packageAll(packages) {
	await bundle(packages);
	const dist = join(root, "dist");
	mkdirSync(dist, { recursive: true });

	const built = [];
	for (const pkg of packages) {
		const packagePath = join(dist, `${pkg.name}-${pkg.manifest.version}.vsix`);
		const license = join(pkg.dir, "LICENSE");
		copyFileSync(join(root, "LICENSE"), license);
		try {
			await createVSIX({
				cwd: pkg.dir,
				packagePath,
				dependencies: false,
				ignoreFile: join(root, ".vscodeignore"),
				baseContentUrl: `${REPOSITORY}/blob/${BRANCH}/packages/${pkg.name}`,
				baseImagesUrl: `${REPOSITORY}/raw/${BRANCH}/packages/${pkg.name}`,
			});
		} finally {
			rmSync(license);
		}
		built.push(packagePath);
	}
	return built;
}

/** @param {string} tag */
async function release(tag) {
	const match = /^(.+)-v(\d+\.\d+\.\d+.*)$/.exec(tag ?? "");
	if (!match) {
		fail(
			`'${tag}' is not a release tag; expected <package>-v<version>, e.g. linq-v0.5.15`,
		);
	}
	const [, name, version] = match;
	const [pkg] = selectPackages([name]);
	if (pkg.manifest.version !== version) {
		fail(
			`Tag version ${version} does not match packages/${name}/package.json version ${pkg.manifest.version}`,
		);
	}
	if (!process.env.VSCE_PAT) {
		fail("VSCE_PAT is not set");
	}

	const [vsix] = await packageAll([pkg]);
	await publishVSIX(vsix, { pat: process.env.VSCE_PAT });
	console.log(`published ${PUBLISHER}.${name} ${version}`);
}

/** @param {string} range e.g. "^1.82.0" or "~1.82.0" */
function minVersion(range) {
	return range.replace(/^[\^~>=]+/, "");
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** @returns {never} */
function fail(message) {
	console.error(message);
	process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
	case "check":
		check();
		break;
	case "lint":
		lint();
		break;
	case "test":
		test();
		break;
	case "format":
		format();
		break;
	case "bundle":
		await bundle(selectPackages(args));
		break;
	case "watch":
		await watch(selectPackages(args));
		break;
	case "package":
		for (const path of await packageAll(selectPackages(args))) {
			console.log(`packaged ${relative(root, path)}`);
		}
		break;
	case "release":
		await release(args[0]);
		break;
	default:
		fail(
			"Usage: node scripts/build.mjs <check|lint|test|format|bundle|watch|package|release> [package...]",
		);
}

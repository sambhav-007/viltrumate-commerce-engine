const fs = require("fs");
const path = require("path");
const { DeploymentProvider } = require("./DeploymentProvider");
const { buildPackage } = require("./packageBuilder");

// ============================================================================
// LocalProvider — the initial DeploymentProvider. It does NOT push to any cloud;
// its job is to GENERATE a complete, self-contained deployment package on disk
// (env files, manifest, healthcheck, nginx template, startup script, secrets
// checklist) that an operator applies manually. Everything a deployment needs
// is in the package directory.
//
// Packages are written under server/deployments/<storeId>/<version>/ (gitignored,
// since backend.env contains secrets).
// ============================================================================
class LocalProvider extends DeploymentProvider {
  constructor(ctx) {
    super(ctx);
    this.name = "local";
  }

  _dir(version = this.ctx.version) {
    return path.join(this.ctx.baseDir, this.ctx.store.storeId, version);
  }
  _rel(version = this.ctx.version) {
    return path
      .relative(path.join(this.ctx.baseDir, ".."), this._dir(version))
      .split(path.sep)
      .join("/");
  }

  // Generate the deployment package for ctx.version and write it to disk.
  async deploy() {
    const built = buildPackage(this.ctx);
    const dir = this._dir();
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(built.files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    fs.writeFileSync(
      path.join(dir, "deploy.log"),
      `[${new Date().toISOString()}] package generated (v${this.ctx.version}, ${this.name})\n`
    );
    return {
      provider: this.name,
      version: this.ctx.version,
      packagePath: this._rel(),
      packageDir: dir,
      files: Object.keys(built.files),
      healthcheck: built.healthcheck,
      rollback: built.rollback,
      secretsChecklist: built.secretsChecklist,
      deploymentJson: built.deploymentJson,
    };
  }

  // A new version is just a fresh package.
  async update() {
    return this.deploy();
  }

  // Remove a version's generated artifacts (does not touch any live infra).
  async destroy(version = this.ctx.version) {
    const dir = this._dir(version);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    return { removed: this._rel(version) };
  }

  // Read the manifest of the latest generated package, if any.
  async status(version = this.ctx.version) {
    const file = path.join(this._dir(version), "deployment.json");
    if (!fs.existsSync(file)) return { state: "not-generated", version };
    return { state: "generated", version, manifest: JSON.parse(fs.readFileSync(file, "utf8")) };
  }

  async logs(version = this.ctx.version) {
    const file = path.join(this._dir(version), "deploy.log");
    return { log: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "" };
  }
}

module.exports = { LocalProvider };

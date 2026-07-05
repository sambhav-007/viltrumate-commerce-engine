// ============================================================================
// DeploymentProvider — the abstraction every deployment target plugs into.
//
// Deployment logic must NEVER be hardcoded into the panel or the commerce
// engine. The panel talks only to this interface; concrete providers (local,
// and later Vercel/Render/Docker/…) implement it. The commerce code has no
// knowledge of deployment at all — only the platform layer does.
//
// Contract:
//   deploy()   -> produce/apply a deployment for a version. For the Local
//                 provider this GENERATES the deployment package (no cloud push).
//   update()   -> apply a new version to an existing deployment.
//   destroy()  -> tear down a deployment / remove its generated artifacts.
//   status()   -> current state of the deployment.
//   logs()     -> deployment logs (or a note where to find them).
//
// ctx: { store, settings, manifest, version, gitCommit, environment, env, baseDir }
// ============================================================================
class DeploymentProvider {
  constructor(ctx = {}) {
    this.ctx = ctx;
    this.name = "abstract";
  }

  async deploy() {
    throw new Error(`${this.name}.deploy() is not implemented`);
  }
  async update() {
    throw new Error(`${this.name}.update() is not implemented`);
  }
  async destroy() {
    throw new Error(`${this.name}.destroy() is not implemented`);
  }
  async status() {
    throw new Error(`${this.name}.status() is not implemented`);
  }
  async logs() {
    throw new Error(`${this.name}.logs() is not implemented`);
  }
}

module.exports = { DeploymentProvider };

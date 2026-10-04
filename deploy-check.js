// Checks shared by the Deploy and Verify pages (AUDIT section 9, M-4).
//
// The CREATE2 address of a LUKSO profile depends on the LSP23 salt, which covers the Key Manager's
// initialization and the post-deployment module, but NOT the UP's own initialization calldata nor the
// funding amounts. A calldata that predicts the right address can therefore still create a different
// profile. Two checks close that gap:
// - initProblems(): before a deploy, the initialization must be the standard one of a LUKSO profile:
//   the UP initialized with the post-deployment module as owner (the module then sets the controllers
//   and hands ownership to the Key Manager), the Key Manager given only the UP's address;
// - link(): on a deployed profile, the UP must be owned by its Key Manager and the Key Manager must
//   control that UP.
(function () {
  const INIT_SELECTOR = "0xc4d66de8"; // initialize(address)
  const IFACE = new ethers.Interface(["function initialize(address)", "function owner() view returns (address)", "function target() view returns (address)"]);

  // Keys of what differs from the standard initialization; empty when it is the standard one.
  function initProblems(d) {
    const out = [];
    let expectedPrimary = null;
    try { expectedPrimary = IFACE.encodeFunctionData("initialize", [d.postDeploymentModule]).toLowerCase(); } catch (e) { /* bad module address */ }
    if (!expectedPrimary || String(d.primary.initCalldata).toLowerCase() !== expectedPrimary) out.push("primaryInit");
    if (String(d.secondary.initCalldata).toLowerCase() !== INIT_SELECTOR) out.push("secondaryInit");
    if (d.secondary.addPrimaryContractAddress !== true) out.push("addPrimary");
    if (String(d.secondary.extraInitParams).toLowerCase() !== "0x") out.push("extra");
    return out;
  }

  // Native currency sent with the deploy (UP and Key Manager funding), in wei.
  const funding = (d) => BigInt(d.primary.fundingAmount) + BigInt(d.secondary.fundingAmount);

  // { ok, owner, target }: ok when UP.owner() is the Key Manager and KeyManager.target() is the UP.
  async function link(provider, up, km) {
    const call = async (to, fn) => {
      const raw = await provider.call({ to, data: IFACE.encodeFunctionData(fn) });
      return ethers.getAddress(IFACE.decodeFunctionResult(fn, raw)[0]);
    };
    let owner = null, target = null;
    try { owner = await call(up, "owner"); } catch (e) { /* not readable */ }
    try { target = await call(km, "target"); } catch (e) { /* not readable */ }
    const ok = !!owner && !!target && owner === ethers.getAddress(km) && target === ethers.getAddress(up);
    return { ok, owner, target };
  }

  window.DeployCheck = { initProblems, funding, link };
})();

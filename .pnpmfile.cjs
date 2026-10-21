module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@prisma/studio-core" && pkg.engines) {
        delete pkg.engines.pnpm;
      }
      return pkg;
    },
  },
};

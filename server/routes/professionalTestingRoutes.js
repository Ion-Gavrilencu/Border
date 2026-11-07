const express = require("express");
const multer = require("multer");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const c = require("../controllers/professionalTestingController");
const importer = require("../controllers/professionalTestingImportController");
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/\.(docx|xlsx|csv|txt|json|pdf)$/i.test(file.originalname)) {
      const err = new Error("Format neacceptat.");
      err.status = 415;
      return cb(err);
    }
    cb(null, true);
  },
});

const uploadOne = (req, res, next) =>
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : err.status || 400).json({
      message: err.code === "LIMIT_FILE_SIZE" ? "Fișierul depășește 5 MB." : err.message,
    });
  });

router.use(authenticate);
router.get("/atribuite", c.listAssigned);
router.get("/rezultatele-mele", c.myResults);
router.get("/incercari/:attemptId/rezultat", c.attemptReview);
router.get("/incercari/:attemptId/revizuire", c.attemptReview);
router.get("/incercari/:attemptId", c.attemptData);
router.put("/incercari/:attemptId/raspuns", c.saveAnswer);
router.post("/incercari/:attemptId/finalizare", c.submit);
router.post("/versiuni/:versionId/incepe", c.startAttempt);
router.delete("/teste/:testId", authorizeRoles("ADMIN"), c.deleteTest);

router.use(authorizeRoles("ADMIN", "EDITOR"));
router.get("/utilizatori-eligibili", c.eligibleUsers);
router.get("/teste", c.listTests);
router.post("/teste", c.createTest);
router.post("/teste/:testId/versiune-noua", c.newVersion);
router.patch("/versiuni/:versionId", c.updateDraft);
router.get("/versiuni/:versionId", c.getVersion);
router.get("/versiuni/:versionId/intrebari", c.getQuestions);
router.post("/versiuni/:versionId/intrebari", c.saveQuestion);
router.post("/versiuni/:versionId/import-previzualizare", uploadOne, importer.previewImport);
router.post(
  "/versiuni/:versionId/import-confirmare",
  express.json({ limit: "2mb" }),
  importer.confirmImport,
);
router.put("/versiuni/:versionId/intrebari/:questionId", c.editQuestion);
router.delete("/versiuni/:versionId/intrebari/:questionId", c.deleteQuestion);
router.post("/versiuni/:versionId/publicare", c.publish);
router.post("/versiuni/:versionId/atribuiri", c.assign);
router.get("/versiuni/:versionId/atribuiri", c.listVersionAssignments);
router.get("/versiuni/:versionId/rezultate", c.managerResults);
router.post("/grupuri", c.createGroup);
router.post("/grupuri/:groupId/membri", c.addGroupMember);

module.exports = router;

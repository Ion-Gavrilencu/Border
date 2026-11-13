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

// Preferințe personale: disponibile tuturor utilizatorilor autentificați.
// Aceste rute trebuie declarate înainte de restricția ADMIN/EDITOR.
router.get("/preferinte", c.getPreferences);
router.put("/preferinte", c.savePreferences);

// Acces pentru utilizatorii autentificați.
router.get("/atribuite", c.listAssigned);
router.get("/rezultatele-mele", c.myResults);
router.get("/incercari/:attemptId/rezultat", c.attemptReview);
router.get("/incercari/:attemptId/revizuire", c.attemptReview);
router.get("/incercari/:attemptId", c.attemptData);
router.put("/incercari/:attemptId/raspuns", c.saveAnswer);
router.post("/incercari/:attemptId/finalizare", c.submit);
router.post("/versiuni/:versionId/incepe", c.startAttempt);

// Ștergerea testelor este rezervată administratorului.
router.delete("/teste/:testId", authorizeRoles("ADMIN"), c.deleteTest);

// Administrarea testelor.
router.use(authorizeRoles("ADMIN", "EDITOR"));
router.get("/incercari/:attemptId/revizuire-manager", c.managerAttemptReview);
router.get("/utilizatori-eligibili", c.eligibleUsers);
router.get("/teste", c.listTests);
router.post("/teste", c.createTest);
router.post("/teste/:testId/versiune-noua", c.newVersion);
router.patch("/versiuni/:versionId", c.updateDraft);
router.get("/versiuni/:versionId", c.getVersion);

// Întrebări: citire, creare, duplicare, modificare și ștergere.
router.get("/versiuni/:versionId/intrebari", c.getQuestions);
router.post("/versiuni/:versionId/intrebari", c.saveQuestion);
router.post("/versiuni/:versionId/intrebari/:questionId/duplicare", c.duplicateQuestion);
router.put("/versiuni/:versionId/intrebari/:questionId", c.editQuestion);
router.delete("/versiuni/:versionId/intrebari/:questionId", c.deleteQuestion);

// Importul întrebărilor.
router.post("/versiuni/:versionId/import-previzualizare", uploadOne, importer.previewImport);
router.post(
  "/versiuni/:versionId/import-confirmare",
  express.json({ limit: "2mb" }),
  importer.confirmImport,
);

router.post("/versiuni/:versionId/publicare", c.publish);
router.post("/versiuni/:versionId/atribuiri", c.assign);
router.get("/versiuni/:versionId/atribuiri", c.listVersionAssignments);
router.get("/versiuni/:versionId/rezultate", c.managerResults);
router.get("/grupuri", c.listGroups);
router.get("/grupuri/:groupId", c.getGroup);
router.patch("/grupuri/:groupId", c.updateGroup);
router.delete("/grupuri/:groupId/membri/:userId", c.removeGroupMember);
router.post("/grupuri/:groupId/membri/lot", c.addGroupMembers);
router.post("/grupuri", c.createGroup);
router.post("/grupuri/:groupId/membri", c.addGroupMember);

module.exports = router;

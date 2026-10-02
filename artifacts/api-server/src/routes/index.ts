import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assistantRouter from "./assistant";
import profileRouter from "./profile";
import membershipRouter from "./membership";
import partnersRouter from "./partners";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assistantRouter);
router.use(profileRouter);
router.use(membershipRouter);
router.use(partnersRouter);

export default router;

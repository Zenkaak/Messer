import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import checkoutRouter from "./checkout";
import walletRouter from "./wallet";
import resellerRouter from "./reseller";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(resellerRouter);
router.use(healthRouter);
router.use(chatRouter);
router.use(checkoutRouter);
router.use(walletRouter);
router.use(ordersRouter);

export default router;

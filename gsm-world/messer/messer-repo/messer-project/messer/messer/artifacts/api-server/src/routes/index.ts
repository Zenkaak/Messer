import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import usersRouter from "./users";
import adminRouter from "./admin";
import authRouter from "./auth";
import checkoutRouter from "./checkout";
import walletRouter from "./wallet";
import activationsRouter from "./activations";
import uploadsRouter from "./uploads";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(checkoutRouter);
router.use(walletRouter);
router.use(activationsRouter);
router.use(uploadsRouter);
router.use(notificationsRouter);

export default router;

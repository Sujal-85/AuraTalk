import jwt from "jsonwebtoken"

export const generateToken = (userId, res) => {

    const token = jwt.sign({userId}, process.env.JWT_SECRET, {

        expiresIn: "7d"
    })

    console.log("Setting JWT cookie with token:", token);
    console.log("NODE_ENV:", process.env.NODE_ENV);
    
    // More permissive cookie settings for development
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
        maxAge: 7*24*60*60*1000,
        httpOnly: true,
        // SameSite=none required for cross-origin requests (frontend on different domain)
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction, // must be true when SameSite=none
    };

    res.cookie("jwt", token, cookieOptions);

    return token;
};
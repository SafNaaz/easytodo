const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy
//const FacebookStrategy = require('passport-facebook').Strategy
const findOrCreate = require('mongoose-findorcreate')

const app = express();

require('dotenv').config()

app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365
    }
}))

app.use(passport.initialize())
app.use(passport.session())

const uri = process.env.ATLAS_URI_TODO;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })

const connection = mongoose.connection;
connection.once('open', () => {
    console.log("MongoDB database connection established successfully");
})

const itemsSchema = mongoose.Schema({
    title: String,
    checked: Boolean
})

const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
    title: "Welcome to Easy ToDo, The simplest one around 😉",
    checked: false
})

const item2 = new Item({
    title: "Add New Item and Hit the ➕ button to add a ToDo",
    checked: false
})

const item3 = new Item({
    title: "Tick the box to mark an item as completed and move to completed section below, remove the tick to move back",
    checked: false
})

const item4 = new Item({
    title: "Hit ❌ button to delete an item",
    checked: false
})

const item5 = new Item({
    title: "Delete all to see the tips again 😉",
    checked: false
})

const item6 = new Item({
    title: "Remove the tick to move back to todo list",
    checked: true
})

const defaultItems = [item1, item2, item3, item4, item5, item6];


const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    googleId: String
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy())

passport.serializeUser((user, done) => {
    done(null, user.id)
})

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user)
    })
})

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'https://easytodo.herokuapp.com/auth/google/secrets'
},
    (accessToken, refreshToken, profile, cb) => {
        User.findOrCreate({ googleId: profile.id, username: profile.displayName }, (err, user) => {
            return cb(err, user)
        })
    }
))

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/notes')
    } else {
        res.render('home');
    }
})

app.get('/notes', (req, res) => {
    if (req.isAuthenticated()) {

        Item.find()
            .catch((err) => {
                console.log(err)
            }).then(foundItems => {
                if (foundItems.length === 0) {
                    Item.insertMany(defaultItems)
                        .catch((err) => {
                            console.log(err)
                        }).then(res.redirect('/notes'))

                } else {
                    res.render("list", { newListItems: foundItems, username: req.user.username })
                }
            })
    } else {
        res.redirect('/login')
    }
})

app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/notes')
    } else {
        res.render('login')
    }
})

app.get('/register', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/notes')
    } else {
        res.render('register', { error: '', username: '', email: '' })
    }
})

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] }))

app.get('/auth/google/secrets',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/notes');
    });

function validate(body) {
    if (body.username === body.password) {
        return 'username and password cannot be same'
    } else if (body.password !== body.password1) {
        return 'Please enter same password'
    }

    re = /[0-9]/;
    if (!re.test(body.password)) {
        return 'password must contain atleast a number (0-9)!'
    }

    re = /[a-z]/;
    if (!re.test(body.password)) {
        return 'password must contain atleast a lower case letter (a-z)!'
    }

    re = /[A-Z]/;
    if (!re.test(body.password)) {
        return 'password must contain atleast an upper case letter (A-Z)!'
    }

    return 'true';
}

app.post('/register', (req, res) => {
    console.log(req.body)
    let validationError = validate(req.body)
    if (validationError !== 'true') {
        res.render('register', { error: validationError, username: req.body.username, email: req.body.email })
    } else {
        User.register({ username: req.body.username, email: req.body.email }, req.body.password, (err, user) => {
            if (err) {
                res.render('register', { error: err.message, username: req.body.username, email: req.body.email })
            } else {
                passport.authenticate('local')(
                    req, res, () => {
                        res.redirect('/notes')
                    }
                )
            }
        })
    }
})


app.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/')
})

app.post('/login', (req, res) => {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, (err) => {
        if (err) {
            console.log(err)

        } else {
            passport.authenticate('local', { failureRedirect: '/register' })(
                req, res, () => {
                    res.redirect('/notes')
                }
            )
        }
    })

})


app.post('/notes', (req, res) => {
    const itemTitle = req.body.newItem;

    const item = new Item({
        title: itemTitle,
        checked: false
    })

    item.save()
        .catch((err) => {
            console.log(err)
        }).then(res.redirect('/notes'))
})

app.post("/delete", (req, res) => {
    const deleteItem = req.body.deleteItem;
    Item.findByIdAndRemove(deleteItem)
        .catch((err) => {
            console.log(err)
        }).then(res.redirect('/notes'))
})

app.post("/update", (req, res) => {
    let itemId = req.body.itemId;
    let checked = (req.body.checked === 'true')

    Item.findOneAndUpdate({ _id: itemId }, { $set: { checked: !checked } })
        .catch((err) => {
            console.log(err)
        })
        .then(res.redirect('/notes'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log("server started in port 3000")
})

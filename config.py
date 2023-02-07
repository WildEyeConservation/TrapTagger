'''
Copyright 2022

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config(object):
    LOAD_TESTING = False
    DEBUGGING = False
    MAINTENANCE = False
    VERSION = 7

    HOST_IP = os.environ.get('HOST_IP')
    REDIS_IP = os.environ.get('REDIS_IP')
    KEY_NAME = os.environ.get('KEY_NAME')
    WORKER_NAME = 'celery@'+os.environ.get('WORKER_NAME')
    QUEUE = os.environ.get('QUEUE')
    BUCKET = os.environ.get('BUCKET')
    SKIP_ID = -117
    SKY_CONST = 0.33
    DETECTOR = 'MDv5b'
    VAT=1.15
    ADMIN_USERS = ['Admin','WildEye','Dashboard']
    AWS_S3_UPLOAD_ACCESS_KEY_ID = os.environ.get('AWS_S3_UPLOAD_ACCESS_KEY_ID')
    AWS_S3_UPLOAD_SECRET_ACCESS_KEY = os.environ.get('AWS_S3_UPLOAD_SECRET_ACCESS_KEY')

    DETECTOR_THRESHOLDS = {
        'MDv4': 0.8,
        'MDv5a': 0.2,
        'MDv5b': 0.1,
        'error': 1.0,
        'golden': 0.9,
        'user': 0
    }

    DISALLOWED_USERNAMES = ['admin','dashboard']

    # SQLAlchemy Config
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_SERVER =  os.environ.get('DATABASE_SERVER')
    SQLALCHEMY_DATABASE_NAME =  os.environ.get('DATABASE_NAME')
    SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_SERVER+"/"+SQLALCHEMY_DATABASE_NAME
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Email Config
    MAIL_SERVER = 'smtp.gmail.com'
    SSL_MAIL_PORT = 465
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    ADMINS = [os.environ.get('MAIL_USERNAME')]
    MONITORED_EMAIL_ADDRESS = os.environ.get('MONITORED_EMAIL_ADDRESS')

    AWS_REGION = os.environ.get('REGION_NAME')
    TOKEN = os.environ.get('TOKEN')
    IAM_ADMIN_GROUP = os.environ.get('IAM_ADMIN_GROUP')

    #Worker config
    PARALLEL_AMI = os.environ.get('PARALLEL_AMI')
    BRANCH = os.environ.get('BRANCH')
    GPU_INSTANCE_TYPES = ['g4dn.xlarge'] #['p3.2xlarge', 'g4dn.xlarge', 'g3s.xlarge']
    CPU_INSTANCE_TYPES = ['t2.medium', 't3a.medium']
    INSTANCE_RATES = {
        'celery':           {'p3.2xlarge': 11668, 'g4dn.xlarge': 4128, 'g3s.xlarge': 2600}, #measured
        'classification':   {'p3.2xlarge': 11668, 'g4dn.xlarge': 4128, 'g3s.xlarge': 2600}, #estimated
        'parallel':         {'t2.medium': 1000, 't3a.medium': 1000},  #estimated
        'default':         {'t2.medium': 1000, 't3a.medium': 1000}  #estimated
    } #Images per hour
    SG_ID = os.environ.get('SG_ID')
    PUBLIC_SUBNET_ID = os.environ.get('PUBLIC_SUBNET_ID')
    PRIVATE_SUBNET_ID = os.environ.get('PRIVATE_SUBNET_ID')
    MAX_INFER = 25
    MAX_CLASSIFICATION = 18
    MAX_PARALLEL = 50
    MAX_DEFAULT = 8
    DNS = os.environ.get('DNS')

    # Species Classification Config
    CLUSTER_DET_COUNT = 1
    DET_RATIO = 0.5
    DET_AREA = 0.005
    MIN_CLASSIFICATION_RATIO = 0.2 #the minimum ratio of detection classifications for a classification to be considered

    # Individual ID Config
    SIMILARITY_SCORE = 0.05

    # Task and survey statuses
    TASK_READY_STATUSES = ['ready','success','successinitial','stopped']
    SURVEY_READY_STATUSES = ['ready','failed','stopped','cancelled']

    # Hotkey info
    NUMBER_OF_HOTKEYS = 37
    EMPTY_HOTKEY_ID= -967

    # Time in seconds allowed for a worker to finish setting up beforte being checked for idleness
    SETUP_PERIOD = {
        'celery': '300',
        'classification': '300',
        'parallel': '300',
        'default': '300'
    }

    #Aurora DB stuff
    MAX_AURORA = 64
    MIN_AURORA = 8
    DB_CLUSTER_NAME= os.environ.get('DB_CLUSTER_NAME')

    # How many multiples of 5 seconds a worker is checked for idleness
    IDLE_MULTIPLIER = {
        'celery': 12,
        'classification': 12,
        'parallel': 48,
        'default': 12
    }

    # Celery Worker concurrency
    CONCURRENCY = {
        'parallel': 1,
        'default': 1
    }

    # Queue config
    QUEUES = {
        'parallel': {
            'type': 'CPU',
            'ami': PARALLEL_AMI,
            'instances': CPU_INSTANCE_TYPES,
            'max_instances': MAX_PARALLEL,
            'launch_delay': 180,
            'rate': 2695,
            'queue_type': 'time',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data':
                'bash /home/ubuntu/TrapTagger/launch.sh ' + 
                'parallel_worker_{}' + ' ' + 
                'parallel' + " '" + 
                HOST_IP + "' '" + 
                SQLALCHEMY_DATABASE_NAME + "' '" + 
                HOST_IP + "' '" + 
                DNS + "' '" + 
                SQLALCHEMY_DATABASE_SERVER + "' '" + 
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                AWS_REGION + "' '" + 
                SECRET_KEY + "' '" + 
                MAIL_USERNAME + "' '" + 
                MAIL_PASSWORD + "' '" + 
                BRANCH + "' '" + 
                SG_ID + "' '" + 
                PUBLIC_SUBNET_ID + "' '" + 
                TOKEN + "' '" + 
                PARALLEL_AMI + "' '" + 
                KEY_NAME + "' '" + 
                SETUP_PERIOD['parallel'] + "' '" + 
                'IDLE_MULTIPLIER' + "' '" + 
                os.environ.get('MAIN_GIT_REPO') + "' '" + 
                str(CONCURRENCY['parallel']) + "' '" + 
                MONITORED_EMAIL_ADDRESS + "' '" + 
                BUCKET + "' '" + 
                IAM_ADMIN_GROUP + "' '" + 
                PRIVATE_SUBNET_ID + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "'" + 
                ' -l info'
        },
        'default': {
            'type': 'CPU',
            'ami': PARALLEL_AMI,
            'instances': CPU_INSTANCE_TYPES,
            'max_instances': MAX_DEFAULT,
            'launch_delay': 180,
            'rate': 3,
            'queue_type': 'local',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data':
                'bash /home/ubuntu/TrapTagger/launch.sh ' + 
                'default_worker_{}' + ' ' + 
                'default' + " '" + 
                HOST_IP + "' '" + 
                SQLALCHEMY_DATABASE_NAME + "' '" + 
                HOST_IP + "' '" + 
                DNS + "' '" + 
                SQLALCHEMY_DATABASE_SERVER + "' '" + 
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' '" + 
                AWS_REGION + "' '" + 
                SECRET_KEY + "' '" + 
                MAIL_USERNAME + "' '" + 
                MAIL_PASSWORD + "' '" + 
                BRANCH + "' '" + 
                SG_ID + "' '" + 
                PUBLIC_SUBNET_ID + "' '" + 
                TOKEN + "' '" + 
                PARALLEL_AMI + "' '" + 
                KEY_NAME + "' '" + 
                SETUP_PERIOD['default'] + "' '" + 
                'IDLE_MULTIPLIER' + "' '" + 
                os.environ.get('MAIN_GIT_REPO') + "' '" + 
                str(CONCURRENCY['default']) + "' '" + 
                MONITORED_EMAIL_ADDRESS + "' '" + 
                BUCKET + "' '" + 
                IAM_ADMIN_GROUP + "' '" + 
                PRIVATE_SUBNET_ID + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "'" + 
                ' -l info'
        },
        'celery': {
            'type': 'GPU',
            'ami': PARALLEL_AMI,
            'instances': GPU_INSTANCE_TYPES,
            'max_instances': MAX_INFER,
            'launch_delay': 600,
            'rate': 35,
            'init_size': 0.5,
            'queue_type': 'rate',
            'repo': os.environ.get('MAIN_GIT_REPO'),
            'branch': BRANCH,
            'user_data': 
                'bash /home/ubuntu/TrapTagger/gpuworker/launch.sh ' + 
                'celery_worker_{}' + ' ' + 
                HOST_IP + ' ' + 
                'celery ' + 
                SETUP_PERIOD['celery'] + " " + 
                'IDLE_MULTIPLIER' + " '" +
                os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
                os.environ.get('AWS_SECRET_ACCESS_KEY') + "' " + 
                '-l info'
        },
        # 'classification': {
        #     'type': 'GPU',
        #     'ami': PARALLEL_AMI,
        #     'instances': GPU_INSTANCE_TYPES,
        #     'max_instances': MAX_CLASSIFICATION,
        #     'launch_delay': 600,
        #     'rate': 4,
        #     'init_size': 2,
        #     'queue_type': 'rate',
        #     'repo': os.environ.get('MAIN_GIT_REPO'),
        #     'branch': BRANCH,
        #     'user_data': 
        #         'bash /home/ubuntu/TrapTagger/gpuworker/launch.sh ' + 
        #         'classification_worker_{}' + ' ' + 
        #         HOST_IP + ' ' + 
        #         'classification ' + 
        #         SETUP_PERIOD['classification'] + " " + 
        #         'IDLE_MULTIPLIER' + " '" +
        #         os.environ.get('AWS_ACCESS_KEY_ID') + "' '" + 
        #         os.environ.get('AWS_SECRET_ACCESS_KEY') + "' " + 
        #         '-l info'
        # },
    }

    # General classifier settings
    CLASSIFIER = {
        'launch_delay': 600,
        'queue_type': 'rate',
        'init_size': 2,
        'max_instances': MAX_CLASSIFICATION,
        'rate': 4,
        'user_data':
            'bash /home/ubuntu/TrapTagger/gpuworker/launch.sh ' + 
            'classification_worker_{}' + ' ' + 
            HOST_IP + ' ' + 
            '{} ' + 
            SETUP_PERIOD['classification'] + " " + 
            'IDLE_MULTIPLIER' + " '" +
            os.environ.get('AWS_S3_DOWNLOAD_ACCESS_KEY_ID') + "' '" + 
            os.environ.get('AWS_S3_DOWNLOAD_SECRET_ACCESS_KEY') + "' " + 
            '-l info'
    }

    # csv options
    CSV_INFO = {
        '0':{'name': 'Image', 'columns': ['Name', 'ID', 'Species Count', 'Labels', 'Sighting Count', 'Tags', 'Timestamp', 'URL', 'Individuals', 'Original Timestamp','Boxes']},
        '1':{'name': 'Capture', 'columns': ['Number', 'ID', 'Species Count', 'Labels', 'Sighting Count', 'Tags', 'Timestamp', 'Image Count', 'URL', 'Individuals']},
        '2':{'name': 'Cluster', 'columns': ['ID', 'Species Count', 'Labels', 'Sighting Count', 'Tags', 'Timestamp', 'Notes', 'Image Count', 'URL', 'Individuals']},
        '3':{'name': 'Camera', 'columns': ['ID', 'Species Count', 'Labels', 'Tags', 'Animal Count', 'Image Count', 'URL', 'Individuals']},
        '4':{'name': 'Site', 'columns': ['Name', 'Species Count', 'Labels', 'Tags', 'Latitude', 'Longitude', 'Altitude', 'Animal Count', 'Image Count', 'URL', 'Individuals']},
        '5':{'name': 'Survey', 'columns': ['Name', 'Species Count', 'Labels', 'Tags', 'Description', 'Animal Count', 'Image Count', 'URL', 'Individuals']},
        '6':{'name': 'Custom', 'columns': []}
    }

    # blank cluster formats
    FINISHED_CLUSTER = {
        'id': '-101',
        'classification': [],
        'required': [],
        'images': [{
            'id': '-101',
            'url': '-101',
            'rating': '-101',
            'detections': [{
                'id': '-101',
                'top': '-101',
                'bottom': '-101',
                'left': '-101',
                'right': '-101',
                'category': '-101',
                'static': '-101'
            }]
        }], 
        'label': '-101', 
        'tags': '-101', 
        'groundTruth': '-101', 
        'trapGroup': '-101'
    }

    EMPTY_CLUSTER = {
        'id': '-99',
        'classification': [],
        'required': [],
        'images': [{
            'id': '-99',
            'url': '-99',
            'rating': '-99',
            'detections': [{
                'id': '-99',
                'top': '-99',
                'bottom': '-99',
                'left': '-99',
                'right': '-99',
                'category': '-99',
                'static': '-99'
            }]
        }], 
        'label': '-99', 
        'tags': '-99', 
        'groundTruth': '-99', 
        'trapGroup': '-99'
    }

    #Random Name generation
    COLOURS = ["Red","Coral","Salmon","Crimson","Pink","Violet","Orange","Gold",
        "Yellow","Peach","Khaki","Lavender","Plum","Magenta","Purple","Indigo","Blue",
        "Chartreuse","Green","Lime","Olive","Aquamarine","Cyan","Teal","Aqua""Cyan",
        "Turquoise","Navy","White","Tan","Rose","Brown","Maroon","Mint","Azure",
        "Beige","Ivory","Grey","Black","Silver"]

    NOUNS = ["apple","bag","balloon","bananas","bed","beef","blouse","book","bookmark",
        "boom box","bottle","bottle cap","bow","bowl","box","bracelet","bread","brocolli",
        "hair brush","buckel","button","camera","candle","candy wrapper","canvas","car",
        "greeting card","playing card","carrots","cat","CD","cell phone","packing peanuts",
        "cinder block","chair","chalk","newspaper","soy sauce packet","chapter book",
        "checkbook","chocolate","clay pot","clock","clothes","computer","conditioner",
        "cookie jar","cork","couch","credit card","cup","deodorant ","desk","door",
        "drawer","drill press","eraser","eye liner","face wash","fake flowers","flag",
        "floor","flowers","food","fork","fridge","glass","glasses","glow stick","grid paper",
        "hair tie","hanger","helmet","house","ipod","charger","key chain","keyboard","keys",
        "knife","lace","lamp","lamp shade","leg warmers","lip gloss","lotion","milk","mirror",
        "model car","money","monitor","mop","mouse pad","mp3 player","nail clippers","nail file",
        "needle","outlet","paint brush","pants","paper","pen","pencil","perfume","phone",
        "photo album","picture frame","pillow","plastic fork","plate","pool stick",
        "soda can","puddle","purse","blanket","radio","remote","ring","rubber band",
        "rubber duck","rug","rusty nail","sailboat","sand paper","sandal","scotch tape",
        "screw","seat belt","shampoo","sharpie","shawl","shirt","shoe lace","shoes",
        "shovel","sidewalk","sketch pad","slipper","soap","socks","sofa","speakers",
        "sponge","spoon","spring","sticky note","stockings","stop sign","street light",
        "sun glasses","table","teddies","television","thermometer","thread","tire swing",
        "tissue box","toe ring","toilet","tomato","tooth picks","toothbrush","toothpaste",
        "towel","tree","truck","tv","twezzers","twister","vase","video games","wallet",
        "washing machine","watch","water bottle","doll","magnet","wagon","headphones",
        "clamp","USB drive","air freshener","piano","ice cube tray","white out","window",
        "controller","coasters","thermostat","zipper"]

    ADJECTIVES = ["aback","abaft","abandoned","abashed","aberrant","abhorrent","abiding",
        "abject","ablaze","able","abnormal","aboard","aboriginal","abortive","abounding",
        "abrasive","abrupt","absent","absorbed","absorbing","abstracted","absurd","abundant",
        "abusive","acceptable","accessible","accidental","accurate","acid","acidic","acoustic",
        "acrid","actually","ad hoc","adamant","adaptable","addicted","adhesive","adjoining",
        "adorable","adventurous","afraid","aggressive","agonizing","agreeable","ahead","ajar",
        "alcoholic","alert","alike","alive","alleged","alluring","aloof","amazing","ambiguous",
        "ambitious","amuck","amused","amusing","ancient","angry","animated","annoyed","annoying",
        "anxious","apathetic","aquatic","aromatic","arrogant","ashamed","aspiring","assorted",
        "astonishing","attractive","auspicious","automatic","available","average","awake",
        "aware","awesome","awful","axiomatic","bad","barbarous","bashful","bawdy","beautiful",
        "befitting","belligerent","beneficial","bent","berserk","best","better","bewildered",
        "big","billowy","bite-sized","bitter","bizarre","black","black-and-white","bloody",
        "blue","blue-eyed","blushing","boiling","boorish","bored","boring","bouncy","boundless",
        "brainy","brash","brave","brawny","breakable","breezy","brief","bright","bright","broad",
        "broken","brown","bumpy","burly","bustling","busy","cagey","calculating","callous","calm",
        "capable","capricious","careful","careless","caring","cautious","ceaseless","certain",
        "changeable","charming","cheap","cheerful","chemical","chief","childlike","chilly",
        "chivalrous","chubby","chunky","clammy","classy","clean","clear","clever","cloistered",
        "cloudy","closed","clumsy","cluttered","coherent","cold","colorful","colossal","combative",
        "comfortable","common","complete","complex","concerned","condemned","confused","conscious",
        "cooing","cool","cooperative","coordinated","courageous","cowardly","crabby","craven","crazy",
        "creepy","crooked","crowded","cruel","cuddly","cultured","cumbersome","curious","curly",
        "curved","curvy","cut","cute","cute","cynical","daffy","daily","damaged","damaging","damp",
        "dangerous","dapper","dark","dashing","dazzling","dead","deadpan","deafening","dear","debonair",
        "decisive","decorous","deep","deeply","defeated","defective","defiant","delicate","delicious",
        "delightful","demonic","delirious","dependent","depressed","deranged","descriptive","deserted",
        "detailed","determined","devilish","didactic","different","difficult","diligent","direful",
        "dirty","disagreeable","disastrous","discreet","disgusted","disgusting","disillusioned",
        "dispensable","distinct","disturbed","divergent","dizzy","domineering","doubtful","drab",
        "draconian","dramatic","dreary","drunk","dry","dull","dusty","dusty","dynamic","dysfunctional",
        "eager","early","earsplitting","earthy","easy","eatable","economic","educated","efficacious",
        "efficient","eight","elastic","elated","elderly","electric","elegant","elfin","elite","embarrassed",
        "eminent","empty","enchanted","enchanting","encouraging","endurable","energetic","enormous",
        "entertaining","enthusiastic","envious","equable","equal","erect","erratic","ethereal",
        "evanescent","evasive","even","excellent","excited","exciting","exclusive","exotic","expensive",
        "extra-large","extra-small","exuberant","exultant","fabulous","faded","faint","fair","faithful",
        "fallacious","false","familiar","famous","fanatical","fancy","fantastic","far","far-flung",
        "fascinated","fast","fat","faulty","fearful","fearless","feeble","feigned","female","fertile",
        "festive","few","fierce","filthy","fine","finicky","first","five","fixed","flagrant","flaky",
        "flashy","flat","flawless","flimsy","flippant","flowery","fluffy","fluttering","foamy","foolish",
        "foregoing","forgetful","fortunate","four","frail","fragile","frantic","free","freezing","frequent",
        "fresh","fretful","friendly","frightened","frightening","full","fumbling","functional","funny",
        "furry","furtive","future","futuristic","fuzzy","gabby","gainful","gamy","gaping","garrulous",
        "gaudy","general","gentle","giant","giddy","gifted","gigantic","glamorous","gleaming","glib",
        "glistening","glorious","glossy","godly","good","goofy","gorgeous","graceful","grandiose",
        "grateful","gratis","gray","greasy","great","greedy","green","grey","grieving","groovy",
        "grotesque","grouchy","grubby","gruesome","grumpy","guarded","guiltless","gullible","gusty",
        "guttural","habitual","half","hallowed","halting","handsome","handsomely","handy","hanging",
        "hapless","happy","hard","hard-to-find","harmonious","harsh","hateful","heady","healthy",
        "heartbreaking","heavenly","heavy","hellish","helpful","helpless","hesitant","hideous","high",
        "highfalutin","high-pitched","hilarious","hissing","historical","holistic","hollow","homeless",
        "homely","honorable","horrible","hospitable","hot","huge","hulking","humdrum","humorous","hungry",
        "hurried","hurt","hushed","husky","hypnotic","hysterical","icky","icy","idiotic","ignorant","ill",
        "illegal","ill-fated","ill-informed","illustrious","imaginary","immense","imminent","impartial",
        "imperfect","impolite","important","imported","impossible","incandescent","incompetent","inconclusive",
        "industrious","incredible","inexpensive","infamous","innate","innocent","inquisitive","insidious",
        "instinctive","intelligent","interesting","internal","invincible","irate","irritating","itchy",
        "jaded","jagged","jazzy","jealous","jittery","jobless","jolly","joyous","judicious","juicy","jumbled",
        "jumpy","juvenile","kaput","keen","kind","kindhearted","kindly","knotty","knowing","knowledgeable",
        "known","labored","lackadaisical","lacking","lame","lamentable","languid","large","last","late",
        "laughable","lavish","lazy","lean","learned","left","legal","lethal","level","lewd","light","like",
        "likeable","limping","literate","little","lively","lively","living","lonely","long","longing",
        "long-term","loose","lopsided","loud","loutish","lovely","loving","low","lowly","lucky","ludicrous",
        "lumpy","lush","luxuriant","lying","lyrical","macabre","macho","maddening","madly","magenta","magical",
        "magnificent","majestic","makeshift","male","malicious","mammoth","maniacal","many","marked","massive",
        "married","marvelous","material","materialistic","mature","mean","measly","meaty","medical","meek","mellow",
        "melodic","melted","merciful","mere","messy","mighty","military","milky","mindless","miniature","minor",
        "miscreant","misty","mixed","moaning","modern","moldy","momentous","motionless","mountainous","muddled",
        "mundane","murky","mushy","mute","mysterious","naive","nappy","narrow","nasty","natural","naughty","nauseating",
        "near","neat","nebulous","necessary","needless","needy","neighborly","nervous","new","next","nice","nifty",
        "nimble","nine","nippy","noiseless","noisy","nonchalant","nondescript","nonstop","normal","nostalgic","nosy",
        "noxious","null","numberless","numerous","nutritious","nutty","oafish","obedient","obeisant","obese","obnoxious",
        "obscene","obsequious","observant","obsolete","obtainable","oceanic","odd","offbeat","old","old-fashioned",
        "omniscient","one","onerous","open","opposite","optimal","orange","ordinary","organic","ossified","outgoing",
        "outrageous","outstanding","oval","overconfident","overjoyed","overrated","overt","overwrought","painful",
        "painstaking","pale","paltry","panicky","panoramic","parallel","parched","parsimonious","past","pastoral",
        "pathetic","peaceful","penitent","perfect","periodic","permissible","perpetual","petite","petite","phobic",
        "physical","picayune","pink","piquant","placid","plain","plant","plastic","plausible","pleasant","plucky",
        "pointless","poised","polite","political","poor","possessive","possible","powerful","precious","premium",
        "present","pretty","previous","pricey","prickly","private","probable","productive","profuse","protective",
        "proud","psychedelic","psychotic","public","puffy","pumped","puny","purple","purring","pushy","puzzled",
        "puzzling","quack","quaint","quarrelsome","questionable","quick","quickest","quiet","quirky","quixotic",
        "quizzical","rabid","racial","ragged","rainy","rambunctious","rampant","rapid","rare","raspy","ratty",
        "ready","real","rebel","receptive","recondite","red","redundant","reflective","regular","relieved",
        "remarkable","reminiscent","repulsive","resolute","resonant","responsible","rhetorical","rich","right",
        "righteous","rightful","rigid","ripe","ritzy","roasted","robust","romantic","roomy","rotten","rough",
        "round","royal","ruddy","rude","rural","rustic","ruthless","sable","sad","safe","salty","same","sassy",
        "satisfying","savory","scandalous","scarce","scared","scary","scattered","scientific","scintillating",
        "scrawny","screeching","second","second-hand","secret","secretive","sedate","seemly","selective","selfish",
        "separate","serious","shaggy","shaky","shallow","sharp","shiny","shivering","shocking","short","shrill","shut",
        "shy","sick","silent","silent","silky","silly","simple","simplistic","sincere","six","skillful","skinny","sleepy",
        "slim","slimy","slippery","sloppy","slow","small","smart","smelly","smiling","smoggy","smooth","sneaky","snobbish",
        "snotty","soft","soggy","solid","somber","sophisticated","sordid","sore","sore","sour","sparkling","special",
        "spectacular","spicy","spiffy","spiky","spiritual","spiteful","splendid","spooky","spotless","spotted","spotty",
        "spurious","squalid","square","squealing","squeamish","staking","stale","standing","statuesque","steadfast","steady",
        "steep","stereotyped","sticky","stiff","stimulating","stingy","stormy","straight","strange","striped","strong","stupendous",
        "stupid","sturdy","subdued","subsequent","substantial","successful","succinct","sudden","sulky","super","superb","superficial",
        "supreme","swanky","sweet","sweltering","swift","symptomatic","synonymous","taboo","tacit","tacky","talented","tall","tame",
        "tan","tangible","tangy","tart","tasteful","tasteless","tasty","tawdry","tearful","tedious","teeny","teeny-tiny","telling",
        "temporary","ten","tender","tense","tense","tenuous","terrible","terrific","tested","testy","thankful","therapeutic","thick",
        "thin","thinkable","third","thirsty","thirsty","thoughtful","thoughtless","threatening","three","thundering","tidy","tight",
        "tightfisted","tiny","tired","tiresome","toothsome","torpid","tough","towering","tranquil","trashy","tremendous","tricky",
        "trite","troubled","truculent","true","truthful","two","typical","ubiquitous","ugliest","ugly","ultra","unable","unaccountable",
        "unadvised","unarmed","unbecoming","unbiased","uncovered","understood","undesirable","unequal","unequaled","uneven","unhealthy",
        "uninterested","unique","unkempt","unknown","unnatural","unruly","unsightly","unsuitable","untidy","unused","unusual","unwieldy",
        "unwritten","upbeat","uppity","upset","uptight","used","useful","useless","utopian","utter","uttermost","vacuous","vagabond",
        "vague","valuable","various","vast","vengeful","venomous","verdant","versed","victorious","vigorous","violent","violet","vivacious",
        "voiceless","volatile","voracious","vulgar","wacky","waggish","waiting","wakeful","wandering","wanting","warlike","warm","wary",
        "wasteful","watery","weak","wealthy","weary","well-groomed","well-made","well-off","well-to-do","wet","whimsical","whispering",
        "white","whole","wholesale","wicked","wide","wide-eyed","wiggly","wild","willing","windy","wiry","wise","wistful","witty",
        "woebegone","womanly","wonderful","wooden","woozy","workable","worried","worthless","wrathful","wretched","wrong","wry",
        "yellow","yielding","young","youthful","yummy","zany","zealous","zesty","zippy","zonked"]